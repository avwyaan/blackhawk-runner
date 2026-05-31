import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (_req) => {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const results: any[] = [];
  for (let i = 1; i <= 10; i++) {
    const email = `test${i}@runcart.local`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "test123",
      email_confirm: true,
      user_metadata: { display_name: `test${i}` },
    });
    results.push({ email, ok: !error, error: error?.message, id: data?.user?.id });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
