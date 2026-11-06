// ConCasa CRM: manually invoked Meta TEST event projector.
// This function NEVER signs up a real number, sends messages, or modifies an advisor account.
// Requires a real Supabase Auth advisor JWT + an already active advisor-owned Meta TEST connection.
import { createClient } from "npm:@supabase/supabase-js@2.108.2";

const TEST_WABA = "1624750772211418";
const TEST_PHONE = "1374640222406439";
const CONCASA_ORG = "50beae49-3961-4163-8e78-2251693f2c19";
const PROJECT_HOST = "fvtqbxukqlajezyyvwzy.supabase.co";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const RESP = (status: number, data: object) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type MetaEvent = {
  id: string; attempts: number; payload: unknown;
};
type Inbound = {
  from: string; id: string; type: string; sentAt: string; text: string | null;
};
const safeString = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;

function parseTestMessages(payload: unknown): Inbound[] | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  if (root.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) return null;
  const output: Inbound[] = [];
  if (root.entry.length === 0) return null;
  for (const unknownEntry of root.entry) {
    if (!unknownEntry || typeof unknownEntry !== "object") return null;
    const entry = unknownEntry as Record<string, unknown>;
    if (entry.id !== TEST_WABA || !Array.isArray(entry.changes)) return null;
    for (const unknownChange of entry.changes) {
      if (!unknownChange || typeof unknownChange !== "object") return null;
      const change = unknownChange as Record<string, unknown>;
      const value = change.value as Record<string, unknown> | undefined;
      const metadata = value?.metadata as Record<string, unknown> | undefined;
      if (change.field !== "messages" || metadata?.phone_number_id !== TEST_PHONE) {
        // Status-only and non-test events are kept raw, not silently processed.
        return null;
      }
      if (!Array.isArray(value?.messages)) return null;
      for (const unknownMessage of value.messages) {
        if (!unknownMessage || typeof unknownMessage !== "object") return null;
        const m = unknownMessage as Record<string, unknown>;
        const from = safeString(m.from);
        const id = safeString(m.id);
        const type = safeString(m.type);
        const ts = safeString(m.timestamp);
        if (!from || !id || !type || !ts || !/^\d{10,12}$/.test(ts)) return null;
        if (!["text", "image", "video", "audio", "document", "location", "sticker"].includes(type)) {
          return null;
        }
        const seconds = Number(ts);
        if (!Number.isSafeInteger(seconds) || seconds < 1577836800 || seconds > 4102444800) return null;
        const t = m.text && typeof m.text === "object" ? m.text as Record<string, unknown> : null;
        output.push({
          from, id, type,
          sentAt: new Date(seconds * 1000).toISOString(),
          text: type === "text" ? safeString(t?.body)?.slice(0, 16000) ?? null : null,
        });
      }
    }
  }
  return output.length ? output : null;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return RESP(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const roleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !roleKey) return RESP(503, { error: "not_configured" });
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== PROJECT_HOST) {
      return RESP(503, { error: "wrong_project" });
    }
  } catch {
    return RESP(503, { error: "invalid_project" });
  }

  const header = request.headers.get("authorization");
  const jwt = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!jwt) return RESP(401, { error: "unauthorized" });
  const admin = createClient(url, roleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const user = await admin.auth.getUser(jwt);
    if (user.error || !user.data.user) return RESP(401, { error: "unauthorized" });
    const userId = user.data.user.id;

    const p = await admin.from("profiles")
      .select("organization_id,app_role,active")
      .eq("id", userId).maybeSingle();
    if (p.error || !p.data || p.data.organization_id !== CONCASA_ORG ||
        p.data.app_role !== "asesor" || p.data.active !== true) {
      return RESP(403, { error: "not_authorized" });
    }

    const c = await admin.from("whatsapp_connections")
      .select("id")
      .eq("advisor_id", userId)
      .eq("organization_id", CONCASA_ORG)
      .eq("connection_type", "meta_test")
      .eq("connection_state", "active")
      .eq("waba_id", TEST_WABA)
      .eq("phone_number_id", TEST_PHONE).maybeSingle();
    if (c.error || !c.data) return RESP(403, { error: "not_enrolled" });

    const batch = await admin.from("whatsapp_webhook_events")
      .select("id,payload,attempts")
      .eq("processing_state", "received")
      .order("received_at", { ascending: true })
      .limit(10);
    if (batch.error) return RESP(503, { error: "events_unavailable" });

    const result = { claimed: 0, projected: 0, failed: 0 };
    for (const raw of (batch.data ?? []) as MetaEvent[]) {
      const items = parseTestMessages(raw.payload);
      if (!items) continue;
      // CAS claim: only one worker gets a row from received -> processing.
      const claim = await admin.from("whatsapp_webhook_events")
        .update({
          processing_state: "processing",
          processing_started_at: new Date().toISOString(),
          attempts: raw.attempts + 1,
          processing_error_code: null,
        })
        .eq("id", raw.id).eq("processing_state", "received").select("id").maybeSingle();
      if (claim.error || !claim.data) continue;
      result.claimed++;

      let errCode: string | null = null;
      for (const m of items) {
        try {
          const insertThread = await admin.from("whatsapp_conversations")
            .upsert({
              connection_id: c.data.id,
              contact_wa_id: m.from,
              last_message_at: m.sentAt,
            }, { onConflict: "connection_id,contact_wa_id", ignoreDuplicates: true });
          if (insertThread.error) { errCode = "thread_write_failed"; break; }
          const thread = await admin.from("whatsapp_conversations")
            .select("id,last_message_at")
            .eq("connection_id", c.data.id)
            .eq("contact_wa_id", m.from).single();
          if (thread.error || !thread.data) { errCode = "thread_read_failed"; break; }

          const insertMessage = await admin.from("whatsapp_messages").upsert({
            conversation_id: thread.data.id,
            meta_message_id: m.id,
            direction: "incoming",
            source: "cloud_api",
            message_type: m.type,
            text_body: m.text,
            sent_at: m.sentAt,
          }, { onConflict: "conversation_id,meta_message_id", ignoreDuplicates: true });
          if (insertMessage.error) { errCode = "message_write_failed"; break; }

          const last = thread.data.last_message_at
            ? Date.parse(thread.data.last_message_at) : Number.NEGATIVE_INFINITY;
          if (last < Date.parse(m.sentAt)) {
            const touch = await admin.from("whatsapp_conversations")
              .update({ last_message_at: m.sentAt }).eq("id", thread.data.id);
            if (touch.error) { errCode = "thread_touch_failed"; break; }
          }
          result.projected++;
        } catch {
          errCode = "projection_exception";
          break;
        }
      }

      const finish = await admin.from("whatsapp_webhook_events")
        .update({
          processing_state: errCode ? "failed" : "processed",
          processing_error_code: errCode,
          processed_at: errCode ? null : new Date().toISOString(),
        })
        .eq("id", raw.id).eq("processing_state", "processing");
      if (errCode || finish.error) result.failed++;
    }

    return RESP(200, result);
  } catch {
    return RESP(503, { error: "unexpected_failure" });
  }
});
