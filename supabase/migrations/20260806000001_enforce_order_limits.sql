-- ─────────────────────────────────────────────────────────────────────────────
-- Enforce run limits server-side
-- ─────────────────────────────────────────────────────────────────────────────
--
-- max_total_orders, max_orders_per_person and the open/not-expired gate were
-- only ever checked in the client (ActiveRunFriend.tsx). That is both:
--
--   * racy — two people submitting at once each read the count before either
--     inserts, so both pass a limit that only one should have, and
--   * bypassable — the anon key ships inside the app bundle, so anyone with a
--     session can POST straight to /rest/v1/order_items. RLS permits the insert
--     on its own; nothing was checking the limits.
--
-- Implemented as AFTER INSERT ... FOR EACH STATEMENT with a NEW TABLE transition
-- table so that a multi-row insert (the client submits a whole list in one call)
-- is validated as a unit rather than row-by-row.
--
-- frozen_allowed is deliberately NOT enforced here: it is display-only in the
-- UI (a "Frozen items OK" badge), not a validation rule.

CREATE OR REPLACE FUNCTION public.enforce_order_item_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec          RECORD;
  r_status     public.run_status;
  r_closes_at  TIMESTAMPTZ;
  r_max_total  INT;
  r_max_person INT;
  total_count  INT;
  person_count INT;
BEGIN
  FOR rec IN
    SELECT DISTINCT o.run_id, o.id AS order_id
    FROM new_rows n
    JOIN public.orders o ON o.id = n.order_id
  LOOP
    -- Lock the run row first. Concurrent inserts against the same run serialize
    -- here, so the counts below are taken against committed state rather than a
    -- stale snapshot — this is what closes the race.
    SELECT status, closes_at, max_total_orders, max_orders_per_person
      INTO r_status, r_closes_at, r_max_total, r_max_person
    FROM public.runs
    WHERE id = rec.run_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Run not found.'
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF r_status <> 'open' OR now() > r_closes_at THEN
      RAISE EXCEPTION 'This run is closed — items can no longer be added.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF r_max_total IS NOT NULL THEN
      SELECT count(*) INTO total_count
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE o.run_id = rec.run_id;

      IF total_count > r_max_total THEN
        RAISE EXCEPTION 'This run is full — total item limit of % reached.', r_max_total
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    IF r_max_person IS NOT NULL THEN
      SELECT count(*) INTO person_count
      FROM public.order_items oi
      WHERE oi.order_id = rec.order_id;

      IF person_count > r_max_person THEN
        RAISE EXCEPTION 'Per-person limit of % items reached.', r_max_person
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS enforce_order_item_limits ON public.order_items;
CREATE TRIGGER enforce_order_item_limits
AFTER INSERT ON public.order_items
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.enforce_order_item_limits();
