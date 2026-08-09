// Sends APNs push notifications to all group members (except runner) when a run is created.
// Called exclusively by a Postgres pg_net trigger — protected by X-Trigger-Secret header.
// Respects each recipient's notification_preferences (notify_run_posted), any
// per-group mute, and instant-vs-digest delivery mode.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, requireTriggerSecret, sendToTokens } from "../_shared/apns.ts";
import { resolveRecipients, enqueueDigest } from "../_shared/recipients.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const forbidden = requireTriggerSecret(req);
  if (forbidden) return forbidden;

  try {
    const { run_id } = await req.json();
    if (!run_id) {
      return new Response(JSON.stringify({ error: "run_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: run } = await supabase
      .from("runs")
      .select("id, store_names, group_id, runner_id, scheduled_at")
      .eq("id", run_id)
      .single();

    if (!run) {
      return new Response(JSON.stringify({ error: "run not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Scheduled-for-later runs don't get an instant "heading out" push — the
    // notify-scheduled-run-reminder cron job pings people as it approaches instead.
    if (run.scheduled_at && new Date(run.scheduled_at as string).getTime() - Date.now() > 5 * 60000) {
      return new Response(JSON.stringify({ sent: 0, reason: "scheduled for later" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: runnerProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", run.runner_id)
      .single();
    const runnerName = runnerProfile?.display_name || "Someone";

    const { data: members } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", run.group_id)
      .neq("user_id", run.runner_id);

    const candidateIds = (members || []).map((m) => m.user_id);
    const { instantUserIds, digestUserIds } = await resolveRecipients(
      supabase,
      run.group_id,
      candidateIds,
      "run_posted"
    );

    const title = `${runnerName} is heading out!`;
    const body = `Store run: ${run.store_names}. Tap to add your items.`;

    await enqueueDigest(supabase, digestUserIds, run.id, "run_posted", title, body);

    if (instantUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, digested: digestUserIds.length, reason: "no instant recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokens } = await supabase
      .from("device_tokens")
      .select("token")
      .in("user_id", instantUserIds);

    const payload = {
      aps: { alert: { title, body }, sound: "default", "mutable-content": 1 },
      run_id: run.id,
      type: "run_started",
    };

    const sent = await sendToTokens(supabase, tokens || [], payload);

    return new Response(
      JSON.stringify({ sent, total: tokens?.length ?? 0, digested: digestUserIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("notify-run-started error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
