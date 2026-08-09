-- ─────────────────────────────────────────────────────────────────────────────
-- Admin mode, group privacy lockdown, and hard group/member caps
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Privacy fix #1: profiles were readable by ANY authenticated user ─────────
-- Scope to: yourself, anyone who shares a group with you, or an admin.
CREATE OR REPLACE FUNCTION public.shares_group_with(_user_id UUID, _other_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = _user_id AND gm2.user_id = _other_user_id
  );
$$;

DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Profiles viewable by self or group co-members"
ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.shares_group_with(auth.uid(), user_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- ── Privacy fix #2: any group member could read every pending invite's ───────
-- email + redeemable invite code for their group. Restrict to the invite's
-- creator (or an admin). Joining still works via the SECURITY DEFINER
-- validate_invite/redeem_invite RPCs, which bypass RLS.
DROP POLICY IF EXISTS "Members can view group invites" ON public.group_invites;
CREATE POLICY "Creator or admin can view group invites"
ON public.group_invites FOR SELECT TO authenticated
USING (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin')
);

-- ── Admin-only group creation ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can create groups" ON public.groups;
CREATE POLICY "Admins can create groups"
ON public.groups FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by AND public.has_role(auth.uid(), 'admin'));

-- ── Admin-only invite creation ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Creator can create invites" ON public.group_invites;
CREATE POLICY "Admin creator can create invites"
ON public.group_invites FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND public.has_role(auth.uid(), 'admin')
  AND EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND created_by = auth.uid())
);

-- ── Admin oversight: admins see every group by default, can opt out per group ─
CREATE TABLE public.admin_group_optouts (
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, group_id)
);
ALTER TABLE public.admin_group_optouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage their own optouts"
ON public.admin_group_optouts FOR ALL TO authenticated
USING (auth.uid() = admin_id AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = admin_id AND public.has_role(auth.uid(), 'admin'));

-- Oversight is visibility-only (SELECT), never counted as real group_members
-- membership, so it never touches the 25-member or 5-groups-per-user caps below.
CREATE OR REPLACE FUNCTION public.admin_can_view_group(_admin_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_admin_id, 'admin')
    AND NOT EXISTS (
      SELECT 1 FROM public.admin_group_optouts
      WHERE admin_id = _admin_id AND group_id = _group_id
    );
$$;

DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;
CREATE POLICY "Members can view their groups"
ON public.groups FOR SELECT TO authenticated
USING (
  public.is_group_member(auth.uid(), id)
  OR auth.uid() = created_by
  OR public.admin_can_view_group(auth.uid(), id)
);

DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
CREATE POLICY "Members can view group members"
ON public.group_members FOR SELECT TO authenticated
USING (
  public.is_group_member(auth.uid(), group_id)
  OR public.admin_can_view_group(auth.uid(), group_id)
);

DROP POLICY IF EXISTS "Members can view group runs" ON public.runs;
CREATE POLICY "Members can view group runs"
ON public.runs FOR SELECT TO authenticated
USING (
  public.is_group_member(auth.uid(), group_id)
  OR public.admin_can_view_group(auth.uid(), group_id)
);

DROP POLICY IF EXISTS "Members can view orders for their runs" ON public.orders;
CREATE POLICY "Members can view orders for their runs"
ON public.orders FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.runs r WHERE r.id = run_id
  AND (public.is_group_member(auth.uid(), r.group_id) OR public.admin_can_view_group(auth.uid(), r.group_id))
));

DROP POLICY IF EXISTS "Members can view order items" ON public.order_items;
CREATE POLICY "Members can view order items"
ON public.order_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  JOIN public.runs r ON r.id = o.run_id
  WHERE o.id = order_id
  AND (public.is_group_member(auth.uid(), r.group_id) OR public.admin_can_view_group(auth.uid(), r.group_id))
));

-- ── Hard caps ──────────────────────────────────────────────────────────────────
-- 25 groups, platform-wide, for now.
CREATE OR REPLACE FUNCTION public.enforce_group_cap()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.groups) >= 25 THEN
    RAISE EXCEPTION 'Platform limit of 25 groups reached';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_group_cap ON public.groups;
CREATE TRIGGER trg_enforce_group_cap
  BEFORE INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_cap();

-- 25 members per group, and (for non-admins) 5 groups per user.
-- Admins are exempt from the 5-groups-per-user cap for real memberships too,
-- separate from the read-only oversight mechanism above.
CREATE OR REPLACE FUNCTION public.enforce_group_member_caps()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.group_members WHERE group_id = NEW.group_id) >= 25 THEN
    RAISE EXCEPTION 'This group has reached its 25-member limit';
  END IF;

  IF NOT public.has_role(NEW.user_id, 'admin')
     AND (SELECT count(*) FROM public.group_members WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'You can only be part of up to 5 groups';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_group_member_caps ON public.group_members;
CREATE TRIGGER trg_enforce_group_member_caps
  BEFORE INSERT ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_member_caps();
