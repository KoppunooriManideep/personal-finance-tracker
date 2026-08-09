-- =============================================================================
-- Personal Finance Tracker - Migration 12: jewellery cost breakdown fields
-- =============================================================================
-- Jewellery purchases bundle non-recoverable charges into the price: making /
-- value-addition, stone charges and GST. We store them as an optional breakdown
-- of the price already captured in price_total_paise (they do NOT add on top).
-- Valuation is unchanged: current value = net gold weight × live rate, so these
-- charges correctly show up as a loss vs the gold content.
--
-- All optional (default 0), used mainly when form = 'jewellery'.
-- =============================================================================

alter table public.gold_holdings
  add column if not exists making_charges_paise bigint  not null default 0
    check (making_charges_paise >= 0),
  add column if not exists va_paise             bigint  not null default 0
    check (va_paise >= 0),
  add column if not exists stone_charges_paise   bigint  not null default 0
    check (stone_charges_paise >= 0),
  add column if not exists gst_percent          numeric(5,2) not null default 0
    check (gst_percent >= 0 and gst_percent <= 100);

-- =============================================================================
-- End migration 12.
-- =============================================================================
