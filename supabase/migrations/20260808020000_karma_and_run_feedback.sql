-- ─────────────────────────────────────────────────────────────────────────────
-- Karma points (runner-only) + run feedback (runner ratings + product feedback)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Karma ──────────────────────────────────────────────────────────────────────
-- Ledger, not a counter column, so every award is auditable and point values can
-- be retuned later without losing history. Only the runner earns karma: once for
-- posting a run, and once per item they mark picked-up while shopping.
CREATE TYPE public.karma_event_type AS ENUM ('run_posted', 'item_picked');

CREATE TABLE public.karma_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.runs(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
  event_type public.karma_event_type NOT NULL,
  points INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.karma_events ENABLE ROW LEVEL SECURITY;

-- One award per run for posting it, one award per item for picking it up —
-- re-checking/un-checking an item in the UI never double-awards.
CREATE UNIQUE INDEX karma_events_run_posted_uniq
  ON public.karma_events (run_id) WHERE event_type = 'run_posted';
CREATE UNIQUE INDEX karma_events_item_picked_uniq
  ON public.karma_events (order_item_id) WHERE event_type = 'item_picked';

-- Karma is public within a shared group (same visibility model as profiles).
CREATE POLICY "Karma visible to self, group co-members, or admin"
ON public.karma_events FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.shares_group_with(auth.uid(), user_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- No direct writes — only the SECURITY DEFINER triggers below may insert.
CREATE POLICY "No direct writes to karma_events"
ON public.karma_events FOR ALL TO authenticated
USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.award_karma_for_run_posted()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.karma_events (user_id, run_id, event_type, points)
  VALUES (NEW.runner_id, NEW.id, 'run_posted', 10)
  ON CONFLICT (run_id) WHERE event_type = 'run_posted' DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_karma_run_posted ON public.runs;
CREATE TRIGGER trg_award_karma_run_posted
  AFTER INSERT ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.award_karma_for_run_posted();

CREATE OR REPLACE FUNCTION public.award_karma_for_item_picked()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_run_id UUID;
  v_runner_id UUID;
BEGIN
  IF NEW.is_picked_up AND NOT OLD.is_picked_up THEN
    SELECT r.id, r.runner_id INTO v_run_id, v_runner_id
    FROM public.orders o
    JOIN public.runs r ON r.id = o.run_id
    WHERE o.id = NEW.order_id;

    INSERT INTO public.karma_events (user_id, run_id, order_item_id, event_type, points)
    VALUES (v_runner_id, v_run_id, NEW.id, 'item_picked', 1)
    ON CONFLICT (order_item_id) WHERE event_type = 'item_picked' DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_karma_item_picked ON public.order_items;
CREATE TRIGGER trg_award_karma_item_picked
  AFTER UPDATE OF is_picked_up ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.award_karma_for_item_picked();

-- security_invoker so the view enforces the querying user's own RLS on
-- karma_events rather than the view owner's.
CREATE VIEW public.karma_totals
WITH (security_invoker = true) AS
SELECT user_id, COALESCE(SUM(points), 0)::INT AS karma_total
FROM public.karma_events
GROUP BY user_id;

GRANT SELECT ON public.karma_totals TO authenticated;

-- ── Run feedback: runner ratings ──────────────────────────────────────────────
-- Recipients (people who had an order on the run) can thumbs up/down + comment
-- on the runner, once per run, editable any time including for past runs.
-- Shown to the runner attributed (rater's name is visible to them).
CREATE TABLE public.run_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thumbs_up BOOLEAN,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, rater_id)
);
ALTER TABLE public.run_ratings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_run_ratings_updated_at BEFORE UPDATE ON public.run_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Rater, the runner, or admin can view ratings"
ON public.run_ratings FOR SELECT TO authenticated
USING (
  auth.uid() = rater_id
  OR EXISTS (SELECT 1 FROM public.runs r WHERE r.id = run_id AND r.runner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Recipients can rate a run they ordered on"
ON public.run_ratings FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = rater_id
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.run_id = run_ratings.run_id AND o.user_id = auth.uid())
  AND NOT EXISTS (SELECT 1 FROM public.runs r WHERE r.id = run_ratings.run_id AND r.runner_id = auth.uid())
);

CREATE POLICY "Rater can edit their own rating"
ON public.run_ratings FOR UPDATE TO authenticated
USING (auth.uid() = rater_id)
WITH CHECK (auth.uid() = rater_id);

-- ── Run feedback: product feedback ────────────────────────────────────────────
-- Free-form "something didn't work well" notes. Any run participant, including
-- the runner, can leave one; visible to the submitter, the run's runner, admins.
CREATE TABLE public.run_product_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.run_product_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submitter, the runner, or admin can view product feedback"
ON public.run_product_feedback FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.runs r WHERE r.id = run_id AND r.runner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Group members can leave product feedback on a run"
ON public.run_product_feedback FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.runs r
    WHERE r.id = run_product_feedback.run_id AND public.is_group_member(auth.uid(), r.group_id)
  )
);
