import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Compare untrusted strings without exposing a matching prefix. */
function safeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

/** Meta's GET subscription handshake. Never log the token or request URL. */
export function metaVerificationChallenge(
  requestUrl: string,
  configuredVerifyToken: string | undefined,
): string | null {
  if (!configuredVerifyToken) return null;

  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }

  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || challenge === null) return null;
  if (!safeEqual(token, configuredVerifyToken)) return null;
  return challenge;
}

/** Meta signs the EXACT raw POST bytes with the ConCasa App Secret. */
export function isValidMetaSignature(
  rawBody: Uint8Array | string,
  header: string | null,
  appSecret: string | undefined,
): boolean {
  if (!appSecret || !header || !/^sha256=[0-9a-f]{64}$/i.test(header)) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  return safeEqual(expected.toLowerCase(), header.toLowerCase());
}
