import {
  isRecipientVerifiedForTest,
  persistOutgoingMessage,
  resolveSendableConnection,
  sendTextViaGraphApi,
  serviceClient,
  verifyAdvisorSession,
} from "@/domain/whatsapp/metaWhatsappSend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

type SendBody = {
  conversationId?: unknown;
  contactWaId?: unknown;
  text?: unknown;
  confirm?: unknown;
};

/** Sends only from verified Meta test sender, on an explicit advisor action. */
export async function POST(request: Request): Promise<Response> {
  if (process.env.META_WHATSAPP_SEND_ENABLED !== "true") {
    return new Response("Unavailable", { status: 503, headers: NO_STORE });
  }

  const client = serviceClient();
  if (!client) return new Response("Unavailable", { status: 503, headers: NO_STORE });

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const identity = await verifyAdvisorSession(client, bearer);
  if (!identity) return new Response("Unauthorized", { status: 401, headers: NO_STORE });

  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (Number(declaredLength) > 8192 || !/^\d+$/.test(declaredLength))) {
    return new Response("Payload too large", { status: 413, headers: NO_STORE });
  }

  let body: SendBody;
  try {
    body = await request.json() as SendBody;
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: NO_STORE });
  }
  if (!body || typeof body !== "object") {
    return new Response("Invalid request", { status: 400, headers: NO_STORE });
  }

  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const requestedRecipient = typeof body.contactWaId === "string" ? body.contactWaId : "";
  const messageText = typeof body.text === "string" ? body.text.trim() : "";
  if (!conversationId || !messageText || messageText.length > 4096 || body.confirm !== true) {
    return new Response("Invalid message or explicit confirmation missing", {
      status: 400,
      headers: NO_STORE,
    });
  }

  const connection = await resolveSendableConnection(client, conversationId, identity.advisorId);
  if ("error" in connection) {
    return new Response("Conversation unavailable", {
      status: connection.error === "database_error" ? 503 : 404, headers: NO_STORE,
    });
  }
  if (connection.connectionType === "coexistence") {
    return new Response("Coexistence sending not implemented", { status: 501, headers: NO_STORE });
  }

  // Browser may provide a phone as a consistency check, never as authority.
  if (requestedRecipient && requestedRecipient !== connection.contactWaId) {
    return new Response("Recipient does not match conversation", { status: 400, headers: NO_STORE });
  }
  const verified = await isRecipientVerifiedForTest(
    client, connection.connectionId, connection.contactWaId,
  );
  if (!verified) {
    return new Response("Recipient not verified in Meta test allowlist", {
      status: 403, headers: NO_STORE,
    });
  }
  const token = process.env.META_WHATSAPP_TEST_ACCESS_TOKEN;
  if (!token) return new Response("Unavailable", { status: 503, headers: NO_STORE });

  const result = await sendTextViaGraphApi({
    phoneNumberId: connection.phoneNumberId,
    to: connection.contactWaId,
    body: messageText,
    accessToken: token,
  });
  if (!result.metaMessageId) {
    return new Response("Meta API did not accept the message", {
      status: result.status >= 400 ? result.status : 502,
      headers: NO_STORE,
    });
  }

  const recorded = await persistOutgoingMessage(client, {
    conversationId,
    metaMessageId: result.metaMessageId,
    text: messageText,
    advisorId: identity.advisorId,
  });
  // Do not suggest retrying when delivery succeeded but storage failed.
  return Response.json(
    {
      sent: true,
      recorded: recorded === "ok",
      metaMessageId: result.metaMessageId,
    },
    { status: recorded === "ok" ? 200 : 207, headers: NO_STORE },
  );
}
