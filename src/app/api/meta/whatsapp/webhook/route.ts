import {
  isValidMetaSignature,
  metaVerificationChallenge,
} from "@/domain/whatsapp/metaWebhookSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * Meta's verification is safe to enable independently of message processing.
 * Set META_WHATSAPP_WEBHOOK_VERIFY_TOKEN only in server-side environment.
 */
export function GET(request: Request): Response {
  const challenge = metaVerificationChallenge(
    request.url,
    process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN,
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
 * SAFETY GATE: this endpoint intentionally does not acknowledge deliveries
 * until durable, idempotent storage and downstream processing exist.
 *
 * Returning 200 without saving the delivery would lose customer messages.
 * Returning 503 instead causes Meta to retry, subject to its retry window.
 * Do NOT connect a real phone number or subscribe live message deliveries
 * while this gate is present.
 */
export async function POST(request: Request): Promise<Response> {
  const appSecret = process.env.META_WHATSAPP_APP_SECRET;
  if (!appSecret) {
    return new Response("Unavailable", { status: 503, headers: NO_STORE });
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413, headers: NO_STORE });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return new Response("Unavailable", { status: 503, headers: NO_STORE });
  }

  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413, headers: NO_STORE });
  }

  if (!isValidMetaSignature(
    rawBody,
    request.headers.get("x-hub-signature-256"),
    appSecret,
  )) {
    return new Response("Unauthorized", { status: 401, headers: NO_STORE });
  }

  return new Response("Durable ingestion not configured", {
    status: 503,
    headers: { ...NO_STORE, "Retry-After": "60" },
  });
}
