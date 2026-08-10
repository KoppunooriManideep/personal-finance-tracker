-- =============================================================================
-- Personal Finance Tracker - Migration 15: jewellery discount field
-- =============================================================================
-- Jewellery invoices often apply a discount before GST (e.g. old-gold exchange
-- or festival offers). price_total_paise is the all-in amount actually paid, so
-- the discount is already baked into it — we store it only so the making / VA /
-- stone / GST breakdown reconciles to the true non-gold premium:
--   net charges = making + VA + stones + GST − discount = price_total − gold value
--
-- Optional (default 0), used mainly when form = 'jewellery'.
-- =============================================================================

alter table public.gold_holdings
  add column if not exists discount_paise bigint not null default 0
    check (discount_paise >= 0);

-- =============================================================================
-- End migration 15.
-- =============================================================================
