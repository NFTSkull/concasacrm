import assert from "node:assert/strict";
import test from "node:test";
import { projectMetaWebhookEnvelope } from "./metaWebhookProjection";

const metadata = { phone_number_id: "example_phone_id", display_phone_number: "5218112345678" };

test("incoming text is assigned to the customer as contact, not the business", () => {
  const result = projectMetaWebhookEnvelope({
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        field: "messages",
        value: {
          metadata,
          messages: [{ from: "5218199999999", id: "wamid.incoming", timestamp: "1793900000", type: "text", text: { body: "¿Me ayudas?" } }],
        },
      }],
    }],
  });
  assert.equal(result.messages.length, 1);
  assert.deepEqual(result.messages[0], {
    phoneNumberId: "example_phone_id",
    contactWaId: "5218199999999",
    metaMessageId: "wamid.incoming",
    direction: "incoming",
    source: "cloud_api",
    messageType: "text",
    textBody: "¿Me ayudas?",
    sentAt: new Date(1793900000 * 1000).toISOString(),
  });
  assert.equal(result.needsFurtherProcessing, false);
});

test("business-app echo is outbound and associated with its recipient", () => {
  const result = projectMetaWebhookEnvelope({
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        field: "smb_message_echoes",
        value: {
          metadata,
          message_echoes: [{ from: "5218112345678", to: "5218199999999", id: "wamid.echo", timestamp: "1793900001", type: "text", text: { body: "Claro" } }],
        },
      }],
    }],
  });
  assert.equal(result.messages[0].direction, "outgoing");
  assert.equal(result.messages[0].source, "business_app");
  assert.equal(result.messages[0].contactWaId, "5218199999999");
  assert.equal(result.needsFurtherProcessing, false);
});

test("preserves status and history as deferred instead of falsely completing", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [
        { field: "messages", value: { metadata, statuses: [{ id: "wamid.x", status: "delivered" }] } },
        { field: "history", value: { metadata, history: [] } },
        { field: "smb_message_echoes", value: { metadata, message_echoes: [{ type: "revoke", id: "wamid.y" }] } },
      ],
    }],
  };
  const result = projectMetaWebhookEnvelope(payload);
  assert.equal(result.messages.length, 0);
  assert.equal(result.needsFurtherProcessing, true);
});

test("invalid or unsupported events are not saved as customer messages", () => {
  const result = projectMetaWebhookEnvelope({ object: "instagram", entry: [] });
  assert.equal(result.messages.length, 0);
  assert.equal(result.needsFurtherProcessing, true);
});
