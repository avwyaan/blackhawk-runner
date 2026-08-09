-- ─────────────────────────────────────────────────────────────────────────────
-- Lightweight emoji reactions on a run — group-visible, fixed palette (not
-- free-text, to keep this simple and avoid a content-moderation surface).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.run_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '❤️', '😂', '🎉', '😮')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, user_id, emoji)
);
ALTER TABLE public.run_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view reactions"
ON public.run_reactions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.runs r WHERE r.id = run_id AND public.is_group_member(auth.uid(), r.group_id)
));

CREATE POLICY "Group members can react"
ON public.run_reactions FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.runs r WHERE r.id = run_id AND public.is_group_member(auth.uid(), r.group_id))
);

CREATE POLICY "Users can remove their own reaction"
ON public.run_reactions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.run_reactions;
