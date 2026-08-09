// Checks for runs scheduled to start soon and sends a one-time reminder.
// Invoked on a schedule (every 15 min, via pg_cron + pg_net) — not per-row like
// the other notify-* functions, since there's no DB event to hang a trigger off
// of for "time is approaching". Protected by X-Trigger-Secret header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, requireTriggerSecret, sendToTokens } from "../_shared/apns.ts";
import { resolveRecipients, enqueueDigest } from "../_shared/recipients.ts";

const REMINDER_WINDOW_MINUTES = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const forbidden = requireTriggerSecret(req);
  if (forbidden) return forbidden;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MINUTES * 60000);

    const { data: dueRuns } = await supabase
      .from("runs")
      .select("id, store_names, group_id, runner_id, scheduled_at")
      .eq("status", "open")
      .is("scheduled_reminder_sent_at", null)
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", windowEnd.toISOString());

    if (!dueRuns || dueRuns.length === 0) {
      return new Response(JSON.stringify({ runs: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;
    let totalDigested = 0;

    for (const run of dueRuns) {
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
        "scheduled_runs"
      );

      const startTime = new Date(run.scheduled_at as string).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
      const title = `Upcoming run: ${run.store_names}`;
      const body = `${runnerName} is heading out around ${startTime}. Add your items now.`;

      await enqueueDigest(supabase, digestUserIds, run.id, "scheduled_reminder", title, body);
      totalDigested += digestUserIds.length;

      if (instantUserIds.length > 0) {
        const { data: tokens } = await supabase
          .from("device_tokens")
          .select("token")
          .in("user_id", instantUserIds);

        const payload = {
          aps: { alert: { title, body }, sound: "default", "mutable-content": 1 },
          run_id: run.id,
          type: "scheduled_reminder",
        };
        totalSent += await sendToTokens(supabase, tokens || [], payload);
      }

      await supabase.from("runs").update({ scheduled_reminder_sent_at: now.toISOString() }).eq("id", run.id);
    }

    return new Response(
      JSON.stringify({ runs: dueRuns.length, sent: totalSent, digested: totalDigested }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("notify-scheduled-run-reminder error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
