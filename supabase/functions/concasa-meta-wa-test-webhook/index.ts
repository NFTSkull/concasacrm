// ConCasa CRM — Meta WhatsApp TEST webhook receiver.
// Isolated Edge Function; does not bypass Vercel SSO or touch existing Edge Functions.
// PUBLIC endpoint: auth is Meta verification token (GET) or Meta HMAC signature (POST).
// POST storage is OFF until CONCASA_WA_INGEST_ENABLED=true in Supabase secrets.
// Scope: development test WABA only. Real advisors are explicitly out of scope.
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const TEST_WABA_ID = "1624750772211418";
const PROJECT_HOST = "fvtqbxukqlajezyyvwzy.supabase.co";
const encoder = new TextEncoder();
const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const RETRY = { ...NO_STORE, "Retry-After": "60" };

function plain(body: string, status: number, extra: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8", ...extra } });
}

function equalConstantTime(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

async function verifyChallenge(requestUrl: string): Promise<Response> {
  const secret = Deno.env.get("CONCASA_WA_VERIFY_TOKEN");
  if (!secret) return plain("Unavailable", 503, RETRY);
  const url = new URL(requestUrl);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode !== "subscribe" || !token || challenge === null || challenge.length > 1024) {
    return plain("Forbidden", 403);
  }

  // Do not log token, query string, or challenge.
  const receivedHash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
  const expectedHash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(secret)));
  if (!equalConstantTime(receivedHash, expectedHash)) return plain("Forbidden", 403);
  return plain(challenge, 200);
}

function parseHex(value: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function validSignature(data: Uint8Array, header: string | null, secret: string): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const bytes = parseHex(header.slice(7));
  if (!bytes) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    return crypto.subtle.verify("HMAC", key, bytes, data);
  } catch {
    return false;
  }
}

type Envelope = { object: "whatsapp_business_account"; entry: Array<Record<string, unknown>> };
function parseEnvelope(bytes: Uint8Array): Envelope | null {
  try {
    const input: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!input || typeof input !== "object") return null;
    const obj = input as Record<string, unknown>;
    if (obj.object !== "whatsapp_business_account" || !Array.isArray(obj.entry) || obj.entry.length === 0) {
      return null;
    }
    if (!obj.entry.every((e: unknown) => e !== null && typeof e === "object" && !Array.isArray(e))) {
      return null;
    }
    return { object: "whatsapp_business_account", entry: obj.entry as Array<Record<string, unknown>> };
  } catch {
    return null;
  }
}

async function postWebhook(req: Request): Promise<Response> {
  // Independent Supabase feature gate; NEVER enabled by Vercel flags.
  if (Deno.env.get("CONCASA_WA_INGEST_ENABLED") !== "true") {
    return plain("Unavailable", 503, RETRY);
  }
  const secret = Deno.env.get("CONCASA_WA_APP_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !supabaseUrl || !serviceKey) return plain("Unavailable", 503, RETRY);

  // Prevent accidental writes to another Supabase project.
  let baseUrl: URL;
  try {
    baseUrl = new URL(supabaseUrl);
    if (baseUrl.protocol !== "https:" || baseUrl.hostname !== PROJECT_HOST) {
      return plain("Unavailable", 503, RETRY);
    }
  } catch {
    return plain("Unavailable", 503, RETRY);
  }

  const length = req.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) {
    return plain("Payload too large", 413);
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await req.arrayBuffer());
  } catch {
    return plain("Unavailable", 503, RETRY);
  }
  if (bytes.byteLength > MAX_BODY_BYTES) return plain("Payload too large", 413);
  if (!await validSignature(bytes, req.headers.get("x-hub-signature-256"), secret)) {
    return plain("Unauthorized", 401);
  }

  const envelope = parseEnvelope(bytes);
  if (!envelope) return plain("Invalid webhook envelope", 400);

  // For this initial pilot, ignore correctly signed events from other WABAs.
  // No real advisor number or another Meta portfolio may be projected.
  if (!envelope.entry.every((e) => e.id === TEST_WABA_ID)) return plain("OK", 200);

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const deliveryHash = Array.from(digest, (x) => x.toString(16).padStart(2, "0")).join("");

  try {
    const endpoint = new URL("/rest/v1/whatsapp_webhook_events", baseUrl);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ delivery_sha256: deliveryHash, payload: envelope }),
      signal: AbortSignal.timeout(9000),
    });

    if (response.ok) return plain("OK", 200);
    if (response.status === 409) {
      // A repeated Meta delivery must be acknowledged without inserting again.
      const error: unknown = await response.json().catch(() => null);
      if (error && typeof error === "object" && (error as { code?: string }).code === "23505") {
        return plain("OK", 200);
      }
    }
    // Never leak SQL errors, event details or secrets to clients/logs.
    return plain("Unavailable", 503, RETRY);
  } catch {
    return plain("Unavailable", 503, RETRY);
  }
}

Deno.serve(async (request: Request) => {
  try {
    if (request.method === "GET") return await verifyChallenge(request.url);
    if (request.method === "POST") return await postWebhook(request);
    return plain("Method not allowed", 405, { Allow: "GET, POST" });
  } catch {
    return plain("Unavailable", 503, RETRY);
  }
});
