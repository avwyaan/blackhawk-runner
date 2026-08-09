// Sends APNs push to group members (except the runner) when a run's status
// changes to 'shopping' (started), 'dropped_off', or 'cancelled'.
// Called exclusively by a Postgres pg_net trigger — protected by X-Trigger-Secret header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, requireTriggerSecret, sendToTokens } from "../_shared/apns.ts";
import { resolveRecipients, enqueueDigest } from "../_shared/recipients.ts";

const COPY: Record<string, (runnerName: string, storeNames: string) => { title: string; body: string }> = {
  shopping: (runnerName, storeNames) => ({
    title: `${runnerName} started shopping!`,
    body: `The list for ${storeNames} is locked — no more items can be added.`,
  }),
  dropped_off: (runnerName, storeNames) => ({
    title: `${runnerName} dropped everything off!`,
    body: `Your ${storeNames} run is complete.`,
  }),
  cancelled: (runnerName, storeNames) => ({
    title: `Run cancelled`,
    body: `${runnerName} cancelled the ${storeNames} run.`,
  }),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const forbidden = requireTriggerSecret(req);
  if (forbidden) return forbidden;

  try {
    const { run_id, status } = await req.json();
    if (!run_id || !status || !COPY[status]) {
      return new Response(JSON.stringify({ error: "run_id and a supported status are required" }), {
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
      .select("id, store_names, group_id, runner_id")
      .eq("id", run_id)
      .single();

    if (!run) {
      return new Response(JSON.stringify({ error: "run not found" }), {
        status: 404,
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
      "status_updates"
    );

    const { title, body } = COPY[status](runnerName, run.store_names);

    await enqueueDigest(supabase, digestUserIds, run.id, `status_${status}`, title, body);

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
      type: `status_${status}`,
    };

    const sent = await sendToTokens(supabase, tokens || [], payload);

    return new Response(
      JSON.stringify({ sent, total: tokens?.length ?? 0, digested: digestUserIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("notify-run-status-changed error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
