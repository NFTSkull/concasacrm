import { createHash, timingSafeEqual } from "node:crypto";
import { processWhatsAppBatch } from "@/domain/whatsapp/metaWebhookProcessor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenEquals(candidate: string, secret: string): boolean {
  const candidateDigest = createHash("sha256").update(candidate).digest();
  const secretDigest = createHash("sha256").update(secret).digest();
  return timingSafeEqual(candidateDigest, secretDigest);
}

/** Operator-invoked only: no cron schedule and no public token exposure. */
export async function POST(request: Request): Promise<Response> {
  const configuredSecret = process.env.META_WHATSAPP_WORKER_SECRET;
  if (!configuredSecret || process.env.META_WHATSAPP_PROJECTOR_ENABLED !== "true") {
    return new Response("Unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const header = request.headers.get("authorization");
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!supplied || !tokenEquals(supplied, configuredSecret)) {
    return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const result = await processWhatsAppBatch();
  return Response.json(result, {
    status: result.unavailable ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
