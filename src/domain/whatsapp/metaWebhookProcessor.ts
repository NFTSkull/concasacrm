import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  projectMetaWebhookEnvelope,
  type ProjectedWhatsAppMessage,
} from "./metaWebhookProjection";

type EventRow = {
  id: string;
  payload: unknown;
  attempts: number;
  processing_state: "received" | "failed";
};

function serviceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) : null;
}

async function persistProjectedMessage(
  client: SupabaseClient,
  item: ProjectedWhatsAppMessage,
): Promise<"ok" | "unmapped" | "database_error"> {
  // Never trust advisor_id from Meta payload. Map Meta's phone_number_id
  // to one explicitly approved, connected, consented owner in our own DB.
  const connectionResult = await client
    .from("whatsapp_connections")
    .select("id")
    .eq("phone_number_id", item.phoneNumberId)
    .eq("connection_state", "active")
    .eq("coexistence_confirmed", true)
    .not("consent_received_at", "is", null)
    .maybeSingle();
  if (connectionResult.error) return "database_error";
  if (!connectionResult.data) return "unmapped";
  const connectionId: string = connectionResult.data.id;

  const createThread = await client
    .from("whatsapp_conversations")
    .upsert(
      { connection_id: connectionId, contact_wa_id: item.contactWaId, last_message_at: item.sentAt },
      { onConflict: "connection_id,contact_wa_id", ignoreDuplicates: true },
    );
  if (createThread.error) return "database_error";

  const thread = await client
    .from("whatsapp_conversations")
    .select("id,last_message_at")
    .eq("connection_id", connectionId)
    .eq("contact_wa_id", item.contactWaId)
    .single();
  if (thread.error || !thread.data) return "database_error";

  const message = await client
    .from("whatsapp_messages")
    .upsert(
      {
        conversation_id: thread.data.id,
        meta_message_id: item.metaMessageId,
        direction: item.direction,
        source: item.source,
        message_type: item.messageType,
        text_body: item.textBody,
        sent_at: item.sentAt,
      },
      { onConflict: "conversation_id,meta_message_id", ignoreDuplicates: true },
    );
  if (message.error) return "database_error";

  const lastMessageTimestamp = thread.data.last_message_at
    ? Date.parse(thread.data.last_message_at) : Number.NEGATIVE_INFINITY;
  if (lastMessageTimestamp < Date.parse(item.sentAt)) {
    const updated = await client
      .from("whatsapp_conversations")
      .update({ last_message_at: item.sentAt })
      .eq("id", thread.data.id);
    if (updated.error) return "database_error";
  }
  return "ok";
}

/**
 * Server-only batch worker. No cron is configured. Gate via both an external
 * bearer secret and META_WHATSAPP_PROJECTOR_ENABLED=true.
 *
 * Unknown event types stay DEFERRED and retain raw payload. A failed event
 * remains retriable, with a capped number of attempts.
 */
export async function processWhatsAppBatch(): Promise<{
  claimed: number;
  processed: number;
  deferred: number;
  failed: number;
  unavailable: boolean;
}> {
  const totals = { claimed: 0, processed: 0, deferred: 0, failed: 0, unavailable: false };
  if (process.env.META_WHATSAPP_PROJECTOR_ENABLED !== "true") {
    return { ...totals, unavailable: true };
  }
  const client = serviceClient();
  if (!client) return { ...totals, unavailable: true };

  const events = await client
    .from("whatsapp_webhook_events")
    .select("id,payload,attempts,processing_state")
    .in("processing_state", ["received", "failed"])
    .lt("attempts", 5)
    .order("received_at", { ascending: true })
    .limit(15);

  if (events.error) return { ...totals, unavailable: true };

  for (const row of (events.data || []) as EventRow[]) {
    const now = new Date().toISOString();
    // One claim wins; competing workers see no row due to state predicate.
    const claim = await client
      .from("whatsapp_webhook_events")
      .update({
        processing_state: "processing",
        processing_started_at: now,
        attempts: row.attempts + 1,
        processing_error_code: null,
      })
      .eq("id", row.id)
      .eq("processing_state", row.processing_state)
      .select("id")
      .maybeSingle();

    if (claim.error || !claim.data) continue;
    totals.claimed += 1;

    const projected = projectMetaWebhookEnvelope(row.payload);
    let failure: string | null = null;

    try {
      for (const item of projected.messages) {
        const outcome = await persistProjectedMessage(client, item);
        if (outcome !== "ok") {
          failure = outcome;
          break;
        }
      }
    } catch {
      failure = "processor_exception";
    }

    const finalState = failure
      ? "failed"
      : projected.needsFurtherProcessing ? "deferred" : "processed";

    const updated = await client
      .from("whatsapp_webhook_events")
      .update({
        processing_state: finalState,
        processed_at: failure ? null : new Date().toISOString(),
        processing_error_code: failure,
      })
      .eq("id", row.id)
      .eq("processing_state", "processing");

    if (updated.error) {
      totals.failed += 1;
    } else if (finalState === "failed") {
      totals.failed += 1;
    } else if (finalState === "deferred") {
      totals.deferred += 1;
    } else {
      totals.processed += 1;
    }
  }
  return totals;
}
