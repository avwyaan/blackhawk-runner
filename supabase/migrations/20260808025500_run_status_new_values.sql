-- Split into its own migration/transaction on purpose: Postgres forbids using a
-- newly added enum value in the same transaction that added it, and the next
-- migration's functions/triggers embed 'dropped_off' and 'cancelled' as literals.
ALTER TYPE public.run_status ADD VALUE IF NOT EXISTS 'dropped_off';
ALTER TYPE public.run_status ADD VALUE IF NOT EXISTS 'cancelled';
