import {
  isValidMetaSignature,
  metaVerificationChallenge,
} from "@/domain/whatsapp/metaWebhookSecurity";
import {
  hashMetaDelivery,
  parseMetaWhatsappEnvelope,
  storeMetaWebhookEnvelope,
} from "@/domain/whatsapp/metaWebhookIngestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const RETRY = { ...NO_STORE, "Retry-After": "60" };
const MAX_BODY_BYTES = 2 * 1024 * 1024;

export function GET(request: Request): Response {
  const challenge = metaVerificationChallenge(
    request.url,
    process.env.META_WEBHOOK_VERIFY_TOKEN,
  );

  if (challenge === null) {
    return new Response("Forbidden", { status: 403, headers: NO_STORE });
  }
  return new Response(challenge, {
    status: 200,
    headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * This handler does not deliver messages to advisors. It only persists
 * authenticated event envelopes, with duplicate deliveries idempotent.
 * Explicit gate is OFF until the migration is applied and verified.
 */
export async function POST(request: Request): Promise<Response> {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || process.env.META_WHATSAPP_INGEST_ENABLED !== "true") {
    return new Response("Unavailable", { status: 503, headers: RETRY });
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && (
    !/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BODY_BYTES
  )) {
    return new Response("Payload too large", { status: 413, headers: NO_STORE });
  }

  let rawBody: Uint8Array;
  try {
    rawBody = new Uint8Array(await request.arrayBuffer());
  } catch {
    return new Response("Unavailable", { status: 503, headers: RETRY });
  }

  if (rawBody.byteLength > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413, headers: NO_STORE });
  }

  if (!isValidMetaSignature(
    rawBody,
    request.headers.get("x-hub-signature-256"),
    appSecret,
  )) {
    return new Response("Unauthorized", { status: 401, headers: NO_STORE });
  }

  const envelope = parseMetaWhatsappEnvelope(rawBody);
  if (!envelope) {
    return new Response("Invalid webhook envelope", { status: 400, headers: NO_STORE });
  }

  const outcome = await storeMetaWebhookEnvelope(envelope, hashMetaDelivery(rawBody));
  if (outcome === "unavailable") {
    // Never acknowledge a signed delivery before durable persistence.
    return new Response("Unavailable", { status: 503, headers: RETRY });
  }

  return new Response("OK", { status: 200, headers: NO_STORE });
}
