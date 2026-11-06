export type ProjectedWhatsAppMessage = Readonly<{
  phoneNumberId: string;
  contactWaId: string;
  metaMessageId: string;
  direction: "incoming" | "outgoing";
  source: "cloud_api" | "business_app";
  messageType: string;
  textBody: string | null;
  sentAt: string;
}>;

export type ProjectionResult = Readonly<{
  messages: ProjectedWhatsAppMessage[];
  needsFurtherProcessing: boolean;
}>;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

const TYPES = new Set(["text", "image", "video", "audio", "document", "location", "sticker"]);

function normalizeMessage(
  message: unknown,
  phoneNumberId: string,
  direction: "incoming" | "outgoing",
): ProjectedWhatsAppMessage | null {
  const m = record(message);
  if (!m) return null;
  const metaMessageId = string(m.id);
  const contactWaId = string(direction === "incoming" ? m.from : m.to);
  const type = string(m.type);
  const time = string(m.timestamp);
  if (!metaMessageId || !contactWaId || !type || !time || !TYPES.has(type)) return null;
  if (!/^\d{10,12}$/.test(time)) return null;
  const timestamp = Number(time);
  if (!Number.isSafeInteger(timestamp) || timestamp < 1577836800 || timestamp > 4102444800) return null;
  const text = record(m.text);
  return {
    phoneNumberId,
    contactWaId,
    metaMessageId,
    direction,
    source: direction === "incoming" ? "cloud_api" : "business_app",
    messageType: type,
    textBody: type === "text" ? string(text?.body)?.slice(0, 16000) ?? null : null,
    sentAt: new Date(timestamp * 1000).toISOString(),
  };
}

/**
 * Only projects supported incoming messages and WhatsApp Business app echoes.
 * History, status, edits/revokes and contact sync are retained in the raw inbox
 * and marked deferred, NOT silently reported as fully processed.
 */
export function projectMetaWebhookEnvelope(payload: unknown): ProjectionResult {
  const root = record(payload);
  const messages: ProjectedWhatsAppMessage[] = [];
  let needsFurtherProcessing = false;
  if (root?.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) {
    return { messages, needsFurtherProcessing: true };
  }

  for (const rawEntry of root.entry) {
    const entry = record(rawEntry);
    if (!entry || !Array.isArray(entry.changes)) {
      needsFurtherProcessing = true;
      continue;
    }

    for (const rawChange of entry.changes) {
      const change = record(rawChange);
      const value = record(change?.value);
      const metadata = record(value?.metadata);
      const phoneNumberId = string(metadata?.phone_number_id);
      const field = string(change?.field);

      if (!value || !phoneNumberId || !field) {
        needsFurtherProcessing = true;
        continue;
      }
      if (field === "messages" && Array.isArray(value.messages)) {
        for (const rawMessage of value.messages) {
          const item = normalizeMessage(rawMessage, phoneNumberId, "incoming");
          if (!item) needsFurtherProcessing = true;
          else messages.push(item);
        }
        // Status changes can arrive in the same envelope; do not discard them.
        if (value.statuses !== undefined) needsFurtherProcessing = true;
      } else if (field === "smb_message_echoes" && Array.isArray(value.message_echoes)) {
        for (const rawMessage of value.message_echoes) {
          const item = normalizeMessage(rawMessage, phoneNumberId, "outgoing");
          if (!item) needsFurtherProcessing = true;
          else messages.push(item);
        }
      } else {
        // Includes history, smb_app_state_sync, account_update, statuses.
        needsFurtherProcessing = true;
      }
    }
  }
  return { messages, needsFurtherProcessing };
}
