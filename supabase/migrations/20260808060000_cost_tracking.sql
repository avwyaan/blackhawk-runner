-- ─────────────────────────────────────────────────────────────────────────────
-- Cost tracking / order splitting, Phase 1 (manual entry — see follow-up
-- discussion for Phase 2 receipt-scan-assist as a separate later project).
--
-- Two entry modes, runner's choice at finish-run time:
--  1. Itemized — price_cents per order_item; tax/tip/delivery split
--     proportionally to each order's subtotal (confirmed with the user).
--  2. Lump sum — one receipt total (already inclusive of tax/tip/fees),
--     split by item count share since there are no per-item prices to be
--     proportional to.
-- No real payment processing — this is an IOU tracker only. paid_at is
-- self-reported by either the recipient or the runner.
--
-- No RLS changes needed: the existing "runner can update any order/order_item
-- in their run" and "users can update their own order" policies already cover
-- every column added here.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS price_cents INT;

ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS lump_sum_total_cents INT;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS tax_cents INT NOT NULL DEFAULT 0;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS tip_cents INT NOT NULL DEFAULT 0;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS delivery_fee_cents INT NOT NULL DEFAULT 0;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS costs_finalized_at TIMESTAMPTZ;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Optional free-text "how to pay me" (e.g. "Venmo @gnesh"), shown to group
-- co-members on the settle-up screen. Deliberately not a structured
-- provider+handle pair with generated deep links — avoids per-provider URL
-- scheme bugs and lets people use whatever payment app the group prefers.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_info TEXT;
