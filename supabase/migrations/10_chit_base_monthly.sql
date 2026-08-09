-- =============================================================================
-- Personal Finance Tracker - Migration 10: mandatory base_monthly on chits
-- =============================================================================
-- Adds base_monthly (the "base EMI" — the flat monthly instalment agreed for the
-- chit) as a stored, NOT NULL column so monthly commission (base EMI − amount
-- actually paid) is computed against a recorded figure rather than an assumed
-- chit_value / tenure_months. Money is BIGINT paise, matching chit_value.
--
-- Existing rows are backfilled with the flat instalment (value / tenure) so the
-- column can be made mandatory without data loss; users can edit it afterwards.
-- =============================================================================

-- 1. Add the column nullable so existing rows survive.
alter table public.chits
  add column if not exists base_monthly bigint;

-- 2. Backfill: flat instalment = chit_value / tenure_months, rounded to paise.
update public.chits
  set base_monthly = round(chit_value::numeric / tenure_months)
  where base_monthly is null;

-- 3. Now enforce NOT NULL.
alter table public.chits
  alter column base_monthly set not null;

-- 4. Guard positivity, exactly like chit_value.
alter table public.chits
  drop constraint if exists chits_base_monthly_positive_check;
alter table public.chits
  add constraint chits_base_monthly_positive_check check (base_monthly > 0);

-- =============================================================================
-- End migration 10.
-- =============================================================================
