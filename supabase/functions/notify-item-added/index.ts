// Sends APNs push to the runner when a group member adds an item to a run.
// Called exclusively by a Postgres pg_net trigger — protected by X-Trigger-Secret header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APNS_KEY_P8 = Deno.env.get("APNS_KEY_P8")!;
const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID")!;
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID")!;
const BUNDLE_ID = "com.blackhawk.runcart";
const APNS_HOST = "https://api.push.apple.com";
const TRIGGER_SECRET = Deno.env.get("TRIGGER_SECRET")!;

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

async function getApnsJwt(): Promise<string> {
  if (cachedJwt && Date.now() - cachedJwt.createdAt < 50 * 60 * 1000) return cachedJwt.token;
  const header = b64url(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID, typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }));
  const unsigned = `${header}.${payload}`;
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(APNS_KEY_P8),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const token = `${unsigned}.${b64url(new Uint8Array(sigBuf))}`;
  cachedJwt = { token, createdAt: Date.now() };
  return token;
}

async function sendPush(deviceToken: string, jwt: string, payload: object) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Reject any caller that doesn't present the shared trigger secret
  if (req.headers.get("x-trigger-secret") !== TRIGGER_SECRET) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { order_item_id } = await req.json();
    if (!order_item_id) {
      return new Response(JSON.stringify({ error: "order_item_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: item } = await supabase
      .from("order_items")
      .select("id, item_name, quantity, order_id")
      .eq("id", order_item_id)
      .single();
    if (!item) {
      return new Response(JSON.stringify({ error: "item not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id, run_id")
      .eq("id", item.order_id)
      .single();
    if (!order) {
      return new Response(JSON.stringify({ error: "order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: run } = await supabase
      .from("runs")
      .select("id, store_names, runner_id, status")
      .eq("id", order.run_id)
      .single();
    if (!run) {
      return new Response(JSON.stringify({ error: "run not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.user_id === run.runner_id) {
      return new Response(JSON.stringify({ sent: 0, reason: "self-add" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adderProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", order.user_id)
      .single();
    const adderName = adderProfile?.display_name || "Someone";

    const { data: tokens } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", run.runner_id);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no device tokens" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = await getApnsJwt();
    const qty = item.quantity > 1 ? `${item.quantity}× ` : "";
    const payload = {
      aps: {
        alert: {
          title: `${adderName} added an item`,
          body: `${qty}${item.item_name} • ${run.store_names}`,
        },
        sound: "default",
        "mutable-content": 1,
      },
      run_id: run.id,
      type: "item_added",
    };

    const results = await Promise.all(tokens.map((t) => sendPush(t.token, jwt, payload)));

    const badTokens = tokens.filter((_, i) => results[i].status === 410).map((t) => t.token);
    if (badTokens.length > 0) {
      await supabase.from("device_tokens").delete().in("token", badTokens);
    }

    const sent = results.filter((r) => r.status === 200).length;
    return new Response(JSON.stringify({ sent, total: tokens.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-item-added error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
