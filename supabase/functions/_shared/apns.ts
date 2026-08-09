// Shared APNs signing + delivery helpers used by every notify-* edge function.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APNS_KEY_P8 = Deno.env.get("APNS_KEY_P8")!;
const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID")!;
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID")!;
const BUNDLE_ID = "com.blackhawk.runcart";
const APNS_HOST = "https://api.push.apple.com";
export const TRIGGER_SECRET = Deno.env.get("TRIGGER_SECRET")!;

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function b64url(input: string | Uint8Array): string {
  const str = typeof input === "string" ? input : String.fromCharCode(...input);
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

let cachedJwt: { token: string; createdAt: number } | null = null;

export async function getApnsJwt(): Promise<string> {
  if (cachedJwt && Date.now() - cachedJwt.createdAt < 50 * 60 * 1000) {
    return cachedJwt.token;
  }

  const header = b64url(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID, typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }));
  const unsigned = `${header}.${payload}`;

  const keyData = pemToArrayBuffer(APNS_KEY_P8);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const sig = b64url(new Uint8Array(sigBuf));
  const token = `${unsigned}.${sig}`;
  cachedJwt = { token, createdAt: Date.now() };
  return token;
}

export async function sendPush(deviceToken: string, jwt: string, payload: object) {
  const res = await fetch(`${APNS_HOST}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: res.status >= 400 ? await res.text() : null };
}

// Sends to every token, prunes tokens APNs reports as gone (410), returns count sent.
export async function sendToTokens(
  supabase: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.45.0").createClient>,
  tokens: { token: string }[],
  payload: object
): Promise<number> {
  if (tokens.length === 0) return 0;
  const jwt = await getApnsJwt();
  const results = await Promise.all(tokens.map((t) => sendPush(t.token, jwt, payload)));
  const badTokens = tokens.filter((_, i) => results[i].status === 410).map((t) => t.token);
  if (badTokens.length > 0) {
    await supabase.from("device_tokens").delete().in("token", badTokens);
  }
  return results.filter((r) => r.status === 200).length;
}

export function requireTriggerSecret(req: Request): Response | null {
  if (req.headers.get("x-trigger-secret") !== TRIGGER_SECRET) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}
