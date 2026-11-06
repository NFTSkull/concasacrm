import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

type MetaWebhookEnvelope = {
  object: "whatsapp_business_account";
  entry: unknown[];
};

export type PersistenceResult = "inserted" | "duplicate" | "unavailable";

/**
 * Recognize the signed WhatsApp notification envelope before persisting it.
 * We do not yet process conversations or associate phones with advisors.
 */
export function parseMetaWhatsappEnvelope(bytes: Uint8Array): MetaWebhookEnvelope | null {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"));
    if (!decoded || typeof decoded !== "object") return null;
    const candidate = decoded as Record<string, unknown>;
    if (candidate.object !== "whatsapp_business_account" || !Array.isArray(candidate.entry)) {
      return null;
    }
    return { object: "whatsapp_business_account", entry: candidate.entry };
  } catch {
    return null;
  }
}

export function hashMetaDelivery(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * RLS blocks all browser access to this table. Uses service role only from
 * the server; never put this key in a NEXT_PUBLIC_ variable.
 */
export async function storeMetaWebhookEnvelope(
  envelope: MetaWebhookEnvelope,
  deliveryHash: string,
): Promise<PersistenceResult> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return "unavailable";

  try {
    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await admin
      .from("whatsapp_webhook_events")
      .insert({ delivery_sha256: deliveryHash, payload: envelope });

    if (!error) return "inserted";
    if (error.code === "23505") return "duplicate";

    // Do not log payloads, secrets, or personal data.
    return "unavailable";
  } catch {
    return "unavailable";
  }
}
