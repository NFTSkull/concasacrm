import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Server-only Meta Cloud API TEST sender. Coexistence sending remains disabled. */
export type AdvisorIdentity = Readonly<{ advisorId: string }>;
export type SendableConnection = Readonly<{
  connectionId: string;
  phoneNumberId: string;
  contactWaId: string;
  connectionType: "meta_test" | "coexistence";
}>;

export function serviceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key
    ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
}

/** Uses server Auth verification, never the caller's claimed advisor ID. */
export async function verifyAdvisorSession(
  client: SupabaseClient,
  bearerToken: string | null,
): Promise<AdvisorIdentity | null> {
  if (!bearerToken) return null;
  const { data, error } = await client.auth.getUser(bearerToken);
  if (error || !data.user) return null;
  const profile = await client.from("profiles")
    .select("id,active,app_role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile.error || !profile.data || profile.data.active !== true ||
      profile.data.app_role !== "asesor") return null;
  return { advisorId: data.user.id };
}

/** Derives the target from the user's owned conversation in the database. */
export async function resolveSendableConnection(
  client: SupabaseClient,
  conversationId: string,
  advisorId: string,
): Promise<SendableConnection | { error: "not_found" | "database_error" }> {
  const result = await client.from("whatsapp_conversations")
    .select("connection_id, contact_wa_id, whatsapp_connections!inner(id, phone_number_id, connection_type, connection_state, advisor_id, coexistence_confirmed, consent_received_at, organization_id)")
    .eq("id", conversationId)
    .maybeSingle();
  if (result.error) return { error: "database_error" };
  if (!result.data) return { error: "not_found" };

  const joined = result.data as unknown as {
    contact_wa_id: string;
    whatsapp_connections: {
      id: string;
      phone_number_id: string;
      connection_type: "meta_test" | "coexistence";
      connection_state: string;
      advisor_id: string;
      organization_id: string;
      coexistence_confirmed: boolean;
      consent_received_at: string | null;
    } | null;
  };
  const connection = joined.whatsapp_connections;
  if (!connection || connection.advisor_id !== advisorId ||
      connection.connection_state !== "active") return { error: "not_found" };
  if (connection.connection_type === "coexistence" &&
      !(connection.coexistence_confirmed && connection.consent_received_at)) {
    return { error: "not_found" };
  }
  const owner = await client.from("profiles").select("id")
    .eq("id", advisorId)
    .eq("organization_id", connection.organization_id)
    .eq("active", true)
    .maybeSingle();
  if (owner.error) return { error: "database_error" };
  if (!owner.data) return { error: "not_found" };

  return {
    connectionId: connection.id,
    phoneNumberId: connection.phone_number_id,
    connectionType: connection.connection_type,
    contactWaId: joined.contact_wa_id,
  };
}

export async function isRecipientVerifiedForTest(
  client: SupabaseClient,
  connectionId: string,
  waId: string,
): Promise<boolean> {
  const result = await client.from("whatsapp_verified_test_recipients")
    .select("id")
    .eq("connection_id", connectionId)
    .eq("wa_id", waId)
    .maybeSingle();
  return !result.error && Boolean(result.data);
}

/** Uses temporary Meta test token; no raw error body or token logging. */
export async function sendTextViaGraphApi(options: {
  phoneNumberId: string;
  to: string;
  body: string;
  accessToken: string;
}): Promise<{ status: number; metaMessageId: string | null }> {
  try {
    const response = await fetch(
      "https://graph.facebook.com/v22.0/" + encodeURIComponent(options.phoneNumberId) + "/messages",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + options.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: options.to,
          type: "text",
          text: { body: options.body },
        }),
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!response.ok) return { status: response.status, metaMessageId: null };
    const data: unknown = await response.json().catch(() => null);
    const messages = data && typeof data === "object" && "messages" in data
      ? (data as { messages?: Array<{ id?: string }> }).messages : undefined;
    const id = messages?.[0]?.id;
    return { status: response.status, metaMessageId: typeof id === "string" ? id : null };
  } catch {
    return { status: 502, metaMessageId: null };
  }
}

export async function persistOutgoingMessage(
  client: SupabaseClient,
  params: {
    conversationId: string;
    metaMessageId: string;
    text: string;
    advisorId: string;
  },
): Promise<"ok" | "database_error"> {
  const result = await client.from("whatsapp_messages").upsert(
    {
      conversation_id: params.conversationId,
      meta_message_id: params.metaMessageId,
      direction: "outgoing",
      source: "cloud_api",
      message_type: "text",
      text_body: params.text.slice(0, 16000),
      sent_at: new Date().toISOString(),
      delivery_status: "sent",
      sent_by_profile_id: params.advisorId,
    },
    { onConflict: "conversation_id,meta_message_id", ignoreDuplicates: true },
  );
  if (result.error) return "database_error";
  const touch = await client.from("whatsapp_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", params.conversationId);
  return touch.error ? "database_error" : "ok";
}
