-- ─────────────────────────────────────────────────────────────────────────────
-- Run lifecycle (dropped-off, cancelled), scheduled runs, and notification
-- preferences (categories, per-group mute, instant vs digest)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Run lifecycle ──────────────────────────────────────────────────────────────
-- 'completed' is retired going forward (it conflated "list locked" with "done");
-- 'shopping' already covers "list locked, no more items, out shopping" and can be
-- triggered any time, even before the order window closes. Delivery is tracked
-- per recipient (a runner drops off at different houses at different times) via
-- orders.dropped_off_at; the run flips to 'dropped_off' once every order has one.
-- (The 'dropped_off'/'cancelled' enum values themselves were added in the prior
-- migration, in their own transaction — see that file for why.)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dropped_off_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.check_run_dropped_off()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total INT;
  v_dropped INT;
BEGIN
  IF NEW.dropped_off_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE dropped_off_at IS NOT NULL)
  INTO v_total, v_dropped
  FROM public.orders WHERE run_id = NEW.run_id;

  IF v_total > 0 AND v_total = v_dropped THEN
    UPDATE public.runs SET status = 'dropped_off'
    WHERE id = NEW.run_id AND status NOT IN ('dropped_off', 'cancelled');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_run_dropped_off ON public.orders;
CREATE TRIGGER trg_check_run_dropped_off
  AFTER UPDATE OF dropped_off_at ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.check_run_dropped_off();

-- ── Scheduled runs ────────────────────────────────────────────────────────────
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS scheduled_reminder_sent_at TIMESTAMPTZ;

-- ── Notification preferences ──────────────────────────────────────────────────
CREATE TABLE public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_run_posted BOOLEAN NOT NULL DEFAULT true,
  notify_status_updates BOOLEAN NOT NULL DEFAULT true,
  notify_live_activities BOOLEAN NOT NULL DEFAULT true,
  notify_scheduled_runs BOOLEAN NOT NULL DEFAULT true,
  delivery_mode TEXT NOT NULL DEFAULT 'instant' CHECK (delivery_mode IN ('instant', 'digest')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own notification preferences"
ON public.notification_preferences FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user_notification_prefs()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_notification_prefs ON auth.users;
CREATE TRIGGER on_auth_user_created_notification_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_notification_prefs();

-- Backfill existing users so every account has a row with the documented defaults.
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT DO NOTHING;

-- ── Per-group mute ────────────────────────────────────────────────────────────
CREATE TABLE public.group_notification_mutes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);
ALTER TABLE public.group_notification_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own group mutes"
ON public.group_notification_mutes FOR ALL TO authenticated
USING (auth.uid() = user_id AND public.is_group_member(auth.uid(), group_id))
WITH CHECK (auth.uid() = user_id AND public.is_group_member(auth.uid(), group_id));

-- ── Digest queue ──────────────────────────────────────────────────────────────
-- Populated by the notify-* edge functions for users on 'digest' delivery mode,
-- flushed hourly by send-notification-digests (scheduled via pg_cron below).
CREATE TABLE public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.runs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- Only the service-role key (used by edge functions, bypasses RLS) touches this.
CREATE POLICY "No direct access to notification_queue"
ON public.notification_queue FOR ALL TO authenticated
USING (false) WITH CHECK (false);

-- ── Run status change notifications (started / dropped off / cancelled) ──────
CREATE OR REPLACE FUNCTION public.notify_run_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  edge_url TEXT := 'https://dixtfwozrmeelrolxvwk.supabase.co/functions/v1/notify-run-status-changed';
  secret_val TEXT;
BEGIN
  IF NEW.status = OLD.status OR NEW.status NOT IN ('shopping', 'dropped_off', 'cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO secret_val
  FROM vault.decrypted_secrets WHERE name = 'TRIGGER_SECRET' LIMIT 1;

  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-trigger-secret', COALESCE(secret_val, '')
               ),
    body := jsonb_build_object('run_id', NEW.id, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_run_status_changed ON public.runs;
CREATE TRIGGER trg_notify_run_status_changed
  AFTER UPDATE OF status ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.notify_run_status_changed();

-- ── Scheduled reminders + digest flush, both driven by pg_cron ───────────────
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_scheduled_run_reminders()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  edge_url TEXT := 'https://dixtfwozrmeelrolxvwk.supabase.co/functions/v1/notify-scheduled-run-reminder';
  secret_val TEXT;
BEGIN
  SELECT decrypted_secret INTO secret_val FROM vault.decrypted_secrets WHERE name = 'TRIGGER_SECRET' LIMIT 1;
  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-trigger-secret', COALESCE(secret_val, ''))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_notification_digest_flush()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  edge_url TEXT := 'https://dixtfwozrmeelrolxvwk.supabase.co/functions/v1/send-notification-digests';
  secret_val TEXT;
BEGIN
  SELECT decrypted_secret INTO secret_val FROM vault.decrypted_secrets WHERE name = 'TRIGGER_SECRET' LIMIT 1;
  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-trigger-secret', COALESCE(secret_val, ''))
  );
END;
$$;

SELECT cron.schedule('scheduled-run-reminders', '*/15 * * * *', $$SELECT public.trigger_scheduled_run_reminders();$$);
SELECT cron.schedule('notification-digest-flush', '0 * * * *', $$SELECT public.trigger_notification_digest_flush();$$);
