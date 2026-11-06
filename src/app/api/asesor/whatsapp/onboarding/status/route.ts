import { serviceClient, verifyAdvisorSession } from "@/domain/whatsapp/metaWhatsappSend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Read-only preflight. Never launches Facebook Login or connects a phone.
 * The actual onboarding exchange is intentionally not enabled yet:
 * no signed token storage, full history sync or provider approval is complete.
 */
export async function GET(request: Request): Promise<Response> {
  const client = serviceClient();
  if (!client) return new Response("No disponible", { status: 503, headers: NO_STORE });

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const identity = await verifyAdvisorSession(client, token);
  if (!identity) return new Response("No autorizado", { status: 401, headers: NO_STORE });

  const [schema, existing] = await Promise.all([
    client.from("whatsapp_connections").select("id").limit(1),
    client.from("whatsapp_connections")
      .select("id,connection_type,connection_state,display_phone_number,created_at")
      .eq("advisor_id", identity.advisorId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const blockers: string[] = [];
  if (schema.error || existing.error) blockers.push("Falta habilitar y probar la base de WhatsApp");
  if (process.env.META_WHATSAPP_INGEST_ENABLED !== "true" ||
      process.env.META_WHATSAPP_PROJECTOR_ENABLED !== "true") {
    blockers.push("Falta validar la recepción y sincronización de mensajes");
  }
  if (process.env.META_WHATSAPP_HISTORY_READY !== "true") {
    blockers.push("Falta terminar la importación segura del historial");
  }
  if (process.env.META_WHATSAPP_META_APPROVED !== "true") {
    blockers.push("Faltan las autorizaciones de Meta para vincular asesores");
  }
  if (!process.env.META_APP_SECRET) {
    blockers.push("Falta completar la configuración privada de Meta");
  }
  // Safety gate: no valid code-exchange and token-vault flow in this PR.
  // This MUST be replaced only when fully implemented and tested.
  blockers.push("Falta validar el intercambio seguro de autorización de Meta");

  return Response.json({
    ready: false,
    blockers,
    connections: schema.error || existing.error ? [] : (existing.data ?? []),
    message: "La vinculación todavía no se encuentra disponible. No se ha modificado tu WhatsApp.",
  }, { headers: NO_STORE });
}
