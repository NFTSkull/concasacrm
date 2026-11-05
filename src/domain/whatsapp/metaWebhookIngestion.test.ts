import assert from "node:assert/strict";
import test from "node:test";
import { hashMetaDelivery, parseMetaWhatsappEnvelope } from "./metaWebhookIngestion";

const sample = Buffer.from('{"object":"whatsapp_business_account","entry":[]}');

test("parses a signed WhatsApp envelope", () => {
  assert.deepEqual(parseMetaWhatsappEnvelope(sample), {
    object: "whatsapp_business_account",
    entry: [],
  });
});

test("rejects malformed and unrelated envelopes", () => {
  assert.equal(parseMetaWhatsappEnvelope(Buffer.from("{")), null);
  assert.equal(parseMetaWhatsappEnvelope(Buffer.from('{"object":"instagram","entry":[]}')), null);
  assert.equal(parseMetaWhatsappEnvelope(Buffer.from('{"object":"whatsapp_business_account"}')), null);
});

test("delivery hash is stable and sensitive to tampering", () => {
  assert.equal(hashMetaDelivery(sample), hashMetaDelivery(Buffer.from(sample)));
  assert.notEqual(hashMetaDelivery(sample), hashMetaDelivery(Buffer.from(sample + " ")));
});
