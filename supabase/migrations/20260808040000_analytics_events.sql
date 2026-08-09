-- ─────────────────────────────────────────────────────────────────────────────
-- UI usage analytics — screen views + key interaction events, for identifying
-- friction points. Structural only: event name, screen, small property bag.
-- Never log free-text content (item names, comments, store names) here.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  screen TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- The client logs its own events; nobody can log on behalf of another user.
CREATE POLICY "Users can log their own analytics events"
ON public.analytics_events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Analytics is for internal product improvement only — admins, not group
-- co-members (unlike profiles/karma, this isn't meant to be peer-visible).
CREATE POLICY "Admins can view analytics events"
ON public.analytics_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX analytics_events_event_name_idx ON public.analytics_events (event_name, created_at);
