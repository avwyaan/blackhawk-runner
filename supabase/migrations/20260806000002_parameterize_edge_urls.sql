-- ─────────────────────────────────────────────────────────────────────────────
-- Read the project URL from vault instead of hardcoding it
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 20260625000001_security_hardening.sql baked the literal project URL into the
-- bodies of notify_run_started() and notify_item_added():
--
--   edge_url TEXT := 'https://dixtfwozrmeelrolxvwk.supabase.co/functions/v1/...';
--
-- That makes the migration set non-portable — it cannot be applied to a second
-- project (a staging environment) without editing SQL, and a staging database
-- would fire push notifications at production edge functions.
--
-- The TRIGGER_SECRET immediately below it was already read from vault at
-- runtime; this does the same for the base URL.
--
-- PREREQUISITE — before applying this migration, create the secret:
--
--   SELECT vault.create_secret(
--     'https://<project-ref>.supabase.co', 'PROJECT_URL', 'Base URL for edge fns'
--   );
--
-- If PROJECT_URL is absent the trigger logs a warning and skips the HTTP call
-- rather than failing the INSERT — a missing notification must never block a
-- user from creating a run or adding an item.

CREATE OR REPLACE FUNCTION public.notify_run_started()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_url    TEXT;
  secret_val  TEXT;
BEGIN
  SELECT decrypted_secret INTO base_url
  FROM vault.decrypted_secrets
  WHERE name = 'PROJECT_URL'
  LIMIT 1;

  IF base_url IS NULL THEN
    RAISE WARNING 'notify_run_started: PROJECT_URL secret not set — skipping notification';
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO secret_val
  FROM vault.decrypted_secrets
  WHERE name = 'TRIGGER_SECRET'
  LIMIT 1;

  PERFORM net.http_post(
    url     := base_url || '/functions/v1/notify-run-started',
    headers := jsonb_build_object(
                 'Content-Type',     'application/json',
                 'x-trigger-secret', COALESCE(secret_val, '')
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
  base_url    TEXT;
  secret_val  TEXT;
BEGIN
  SELECT decrypted_secret INTO base_url
  FROM vault.decrypted_secrets
  WHERE name = 'PROJECT_URL'
  LIMIT 1;

  IF base_url IS NULL THEN
    RAISE WARNING 'notify_item_added: PROJECT_URL secret not set — skipping notification';
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO secret_val
  FROM vault.decrypted_secrets
  WHERE name = 'TRIGGER_SECRET'
  LIMIT 1;

  PERFORM net.http_post(
    url     := base_url || '/functions/v1/notify-item-added',
    headers := jsonb_build_object(
                 'Content-Type',     'application/json',
                 'x-trigger-secret', COALESCE(secret_val, '')
               ),
    body    := jsonb_build_object('order_item_id', NEW.id)
  );
  RETURN NEW;
END;
$$;
