// Flushes queued notifications for users on 'digest' delivery mode into a single
// batched push per user. Invoked hourly via pg_cron + pg_net.
// Protected by X-Trigger-Secret header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, requireTriggerSecret, sendToTokens } from "../_shared/apns.ts";

const MAX_LISTED = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const forbidden = requireTriggerSecret(req);
  if (forbidden) return forbidden;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: queued } = await supabase
      .from("notification_queue")
      .select("id, user_id, title")
      .is("sent_at", null)
      .order("created_at", { ascending: true });

    if (!queued || queued.length === 0) {
      return new Response(JSON.stringify({ users: 0, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const byUser = new Map<string, { ids: string[]; titles: string[] }>();
    for (const row of queued) {
      const entry = byUser.get(row.user_id) ?? { ids: [], titles: [] };
      entry.ids.push(row.id);
      entry.titles.push(row.title);
      byUser.set(row.user_id, entry);
    }

    let totalSent = 0;
    const flushedIds: string[] = [];

    for (const [userId, { ids, titles }] of byUser) {
      const { data: tokens } = await supabase.from("device_tokens").select("token").eq("user_id", userId);
      if (!tokens || tokens.length === 0) {
        flushedIds.push(...ids);
        continue;
      }

      const listed = titles.slice(0, MAX_LISTED).join(", ");
      const extra = titles.length > MAX_LISTED ? ` and ${titles.length - MAX_LISTED} more` : "";
      const payload = {
        aps: {
          alert: {
            title: `${titles.length} update${titles.length > 1 ? "s" : ""} from RunCart`,
            body: `${listed}${extra}`,
          },
          sound: "default",
          "mutable-content": 1,
        },
        type: "digest",
      };

      totalSent += await sendToTokens(supabase, tokens, payload);
      flushedIds.push(...ids);
    }

    if (flushedIds.length > 0) {
      await supabase
        .from("notification_queue")
        .update({ sent_at: new Date().toISOString() })
        .in("id", flushedIds);
    }

    return new Response(
      JSON.stringify({ users: byUser.size, sent: totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-notification-digests error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
