
-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening migration
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Fix #1: orders INSERT must verify group membership ────────────────────────
DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
CREATE POLICY "Users can create own orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.id = run_id
        AND public.is_group_member(auth.uid(), r.group_id)
    )
  );

-- ── Fix #2: drop the permissive group_invites SELECT policy ──────────────────
-- The USING(true) policy let any authenticated user read all invite codes/emails.
-- validate_invite and redeem_invite are SECURITY DEFINER and bypass RLS safely.
DROP POLICY IF EXISTS "Anyone can lookup invite by code" ON public.group_invites;

-- ── Fix #3: user_roles — explicit deny for direct writes ─────────────────────
-- No authenticated user should ever be able to directly insert/update/delete
-- their own role. The assign_user_role trigger (SECURITY DEFINER) handles it.
DROP POLICY IF EXISTS "Users cannot self-modify roles" ON public.user_roles;
CREATE POLICY "Users cannot self-modify roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- ── Fix #4: revoke anon access to validate_invite ────────────────────────────
-- Auth.tsx calls signUp() directly; the check_allowed_email trigger enforces the
-- invite check server-side, so no anon pre-validation RPC is needed.
REVOKE EXECUTE ON FUNCTION public.validate_invite(text, text) FROM anon;

-- ── Fix #5: update pg_net triggers to include the trigger secret ──────────────
-- The TRIGGER_SECRET value is read at runtime from vault.secrets inside the
-- trigger function so it never appears in plain SQL.

CREATE OR REPLACE FUNCTION public.notify_run_started()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_url    TEXT := 'https://dixtfwozrmeelrolxvwk.supabase.co/functions/v1/notify-run-started';
  secret_val  TEXT;
BEGIN
  SELECT decrypted_secret INTO secret_val
  FROM vault.decrypted_secrets
  WHERE name = 'TRIGGER_SECRET'
  LIMIT 1;

  PERFORM net.http_post(
    url     := edge_url,
    headers := jsonb_build_object(
                 'Content-Type',      'application/json',
                 'x-trigger-secret',  COALESCE(secret_val, '')
               ),
    body    := jsonb_build_object('run_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_item_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_url    TEXT := 'https://dixtfwozrmeelrolxvwk.supabase.co/functions/v1/notify-item-added';
  secret_val  TEXT;
BEGIN
  SELECT decrypted_secret INTO secret_val
  FROM vault.decrypted_secrets
  WHERE name = 'TRIGGER_SECRET'
  LIMIT 1;

  PERFORM net.http_post(
    url     := edge_url,
    headers := jsonb_build_object(
                 'Content-Type',      'application/json',
                 'x-trigger-secret',  COALESCE(secret_val, '')
               ),
    body    := jsonb_build_object('order_item_id', NEW.id)
  );
  RETURN NEW;
END;
$$;
