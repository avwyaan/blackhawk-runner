
-- 1. Attach existing notify_run_started() as AFTER INSERT trigger on runs
DROP TRIGGER IF EXISTS trg_notify_run_started ON public.runs;
CREATE TRIGGER trg_notify_run_started
AFTER INSERT ON public.runs
FOR EACH ROW
EXECUTE FUNCTION public.notify_run_started();

-- 2. New function to notify runner when an item is added
CREATE OR REPLACE FUNCTION public.notify_item_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_url TEXT := 'https://dixtfwozrmeelrolxvwk.supabase.co/functions/v1/notify-item-added';
BEGIN
  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('order_item_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_item_added ON public.order_items;
CREATE TRIGGER trg_notify_item_added
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.notify_item_added();
