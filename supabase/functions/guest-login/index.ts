import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAGIC_WORDS = ["maggie", "sika", "eland", "rolling", "carries"];
const GUEST_USER_ID = "11111111-1111-1111-1111-111111111111";
const GUEST_EMAIL = "guest@runcart.local";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();
    if (typeof password !== "string" || password.length === 0) {
      return new Response(JSON.stringify({ ok: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lower = password.toLowerCase();
    const matches = MAGIC_WORDS.some((w) => lower.includes(w));
    if (!matches) {
      return new Response(JSON.stringify({ ok: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Mint a fresh single-use password for the guest account
    const ephemeralPassword = crypto.randomUUID() + "-" + crypto.randomUUID();

    const { error: updateErr } = await admin.auth.admin.updateUserById(
      GUEST_USER_ID,
      { password: ephemeralPassword, email_confirm: true },
    );

    if (updateErr) {
      console.error("updateUserById failed", updateErr);
      return new Response(
        JSON.stringify({ ok: false, error: "guest_unavailable" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        email: GUEST_EMAIL,
        password: ephemeralPassword,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("guest-login error", e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
