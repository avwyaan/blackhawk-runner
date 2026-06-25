-- Validate invite code + email before signup (callable without auth)
CREATE OR REPLACE FUNCTION public.validate_invite(p_email text, p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  SELECT group_id INTO v_group_id
  FROM public.group_invites
  WHERE lower(email) = lower(p_email)
    AND lower(invite_code) = lower(p_code)
    AND used_at IS NULL;
  RETURN v_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invite(text, text) TO anon;

-- Redeem invite after signup: joins the group and marks invite as used
CREATE OR REPLACE FUNCTION public.redeem_invite(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_invite_id uuid;
  v_user_email text;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  SELECT group_id, id INTO v_group_id, v_invite_id
  FROM public.group_invites
  WHERE lower(email) = lower(v_user_email)
    AND lower(invite_code) = lower(p_code)
    AND used_at IS NULL;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or already used invite code';
  END IF;

  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_group_id, auth.uid())
  ON CONFLICT DO NOTHING;

  UPDATE public.group_invites SET used_at = now() WHERE id = v_invite_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;
