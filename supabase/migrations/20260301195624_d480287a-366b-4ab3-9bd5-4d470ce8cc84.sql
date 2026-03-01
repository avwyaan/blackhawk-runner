
-- Create group_invites table for per-email invite codes
CREATE TABLE public.group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  email text NOT NULL,
  invite_code text NOT NULL DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  UNIQUE(group_id, email)
);

ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

-- Group members can view invites for their groups
CREATE POLICY "Members can view group invites"
ON public.group_invites
FOR SELECT
TO authenticated
USING (is_group_member(auth.uid(), group_id) OR auth.uid() = created_by);

-- Group creator can create invites
CREATE POLICY "Creator can create invites"
ON public.group_invites
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND created_by = auth.uid())
);

-- Group creator can delete invites
CREATE POLICY "Creator can delete invites"
ON public.group_invites
FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND created_by = auth.uid()));

-- Group creator can update invites (mark as used)
CREATE POLICY "Creator can update invites"
ON public.group_invites
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND created_by = auth.uid()));

-- Also add the invited email to allowed_emails automatically
-- And allow group creator to remove members
CREATE POLICY "Creator can remove members"
ON public.group_members
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND created_by = auth.uid())
);

-- Drop the old "Users can leave groups" policy and replace
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;

-- Allow anyone to look up an invite by code (for joining)
CREATE POLICY "Anyone can lookup invite by code"
ON public.group_invites
FOR SELECT
TO authenticated
USING (true);
