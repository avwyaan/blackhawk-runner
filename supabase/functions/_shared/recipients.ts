// Resolves which group members should actually receive a given notification,
// after applying per-group mute and the category/delivery preferences from
// notification_preferences. Shared by every notify-* edge function so the
// gating logic lives in exactly one place.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type SupabaseClient = ReturnType<typeof createClient>;

export type NotificationCategory = "run_posted" | "status_updates" | "scheduled_runs";

const CATEGORY_COLUMN: Record<NotificationCategory, string> = {
  run_posted: "notify_run_posted",
  status_updates: "notify_status_updates",
  scheduled_runs: "notify_scheduled_runs",
};

export interface ResolvedRecipients {
  instantUserIds: string[];
  digestUserIds: string[];
}

// `category` is null for notifications (like "item added") that aren't gated
// by one of the dedicated category toggles — those still respect mute + delivery mode.
export async function resolveRecipients(
  supabase: SupabaseClient,
  groupId: string,
  candidateUserIds: string[],
  category: NotificationCategory | null
): Promise<ResolvedRecipients> {
  if (candidateUserIds.length === 0) return { instantUserIds: [], digestUserIds: [] };

  const [{ data: mutes }, { data: prefs }] = await Promise.all([
    supabase
      .from("group_notification_mutes")
      .select("user_id")
      .eq("group_id", groupId)
      .in("user_id", candidateUserIds),
    supabase
      .from("notification_preferences")
      .select("user_id, delivery_mode, notify_run_posted, notify_status_updates, notify_scheduled_runs")
      .in("user_id", candidateUserIds),
  ]);

  const mutedIds = new Set((mutes || []).map((m: any) => m.user_id as string));
  const prefMap = new Map((prefs || []).map((p: any) => [p.user_id as string, p]));

  const instantUserIds: string[] = [];
  const digestUserIds: string[] = [];

  for (const userId of candidateUserIds) {
    if (mutedIds.has(userId)) continue;

    const pref = prefMap.get(userId);
    const categoryColumn = category ? CATEGORY_COLUMN[category] : null;
    // Missing pref row (shouldn't happen — created on signup) defaults to on/instant.
    if (categoryColumn && pref && pref[categoryColumn] === false) continue;

    if (pref?.delivery_mode === "digest") digestUserIds.push(userId);
    else instantUserIds.push(userId);
  }

  return { instantUserIds, digestUserIds };
}

export async function enqueueDigest(
  supabase: SupabaseClient,
  userIds: string[],
  runId: string | null,
  category: string,
  title: string,
  body: string
) {
  if (userIds.length === 0) return;
  await supabase
    .from("notification_queue")
    .insert(userIds.map((user_id) => ({ user_id, run_id: runId, category, title, body })));
}
