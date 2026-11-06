import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  isValidMetaSignature,
  metaVerificationChallenge,
} from "./metaWebhookSecurity";

const verifyToken = "not-a-real-secret-123";

test("returns challenge only with correct mode and verify token", () => {
  const url = new URL("https://example.com/api/meta/whatsapp/webhook");
  url.searchParams.set("hub.mode", "subscribe");
  url.searchParams.set("hub.verify_token", verifyToken);
  url.searchParams.set("hub.challenge", "0987654321");
  assert.equal(metaVerificationChallenge(url.toString(), verifyToken), "0987654321");
  assert.equal(metaVerificationChallenge(url.toString(), "wrong"), null);
  assert.equal(metaVerificationChallenge(url.toString(), undefined), null);
  url.searchParams.set("hub.mode", "invalid");
  assert.equal(metaVerificationChallenge(url.toString(), verifyToken), null);
});

test("missing or malformed handshake is rejected", () => {
  assert.equal(metaVerificationChallenge("not-a-url", verifyToken), null);
  assert.equal(metaVerificationChallenge("https://example.com/", verifyToken), null);
  assert.equal(metaVerificationChallenge("https://example.com/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1", verifyToken), null);
});

test("valid raw-body HMAC-SHA256 is accepted", () => {
  const appSecret = "test-only-app-secret";
  const body = '{"object":"whatsapp_business_account","entry":[]}';
  const sig = `sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`;
  assert.equal(isValidMetaSignature(body, sig, appSecret), true);
});

test("tampered body, malformed signature and missing secret are rejected", () => {
  const appSecret = "test-only-app-secret";
  const body = '{"object":"whatsapp_business_account"}';
  const sig = `sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`;
  assert.equal(isValidMetaSignature(body + " ", sig, appSecret), false);
  assert.equal(isValidMetaSignature(body, "sha256=bad", appSecret), false);
  assert.equal(isValidMetaSignature(body, null, appSecret), false);
  assert.equal(isValidMetaSignature(body, sig, undefined), false);
});
