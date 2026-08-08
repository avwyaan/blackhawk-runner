import { supabase } from "@/integrations/supabase/client";

// Structural-only usage analytics: event name, screen, and small primitive
// properties. Never pass free-text content (item names, comments, store
// names, display names) here — see the analytics_events migration.
type AnalyticsProperties = Record<string, string | number | boolean | null>;

let currentUserId: string | null = null;

// Wired from AuthProvider so trackEvent doesn't need every call site to know
// who's logged in, and so nothing is ever logged for a signed-out visitor.
export function setAnalyticsUser(userId: string | null) {
  currentUserId = userId;
}

export function trackEvent(
  eventName: string,
  opts: { screen?: string; groupId?: string; properties?: AnalyticsProperties } = {}
) {
  if (!currentUserId) return;
  supabase
    .from("analytics_events")
    .insert({
      user_id: currentUserId,
      event_name: eventName,
      screen: opts.screen ?? null,
      group_id: opts.groupId ?? null,
      properties: opts.properties ?? {},
    })
    .then(({ error }) => {
      if (error) console.warn("analytics track failed:", error.message);
    });
}
