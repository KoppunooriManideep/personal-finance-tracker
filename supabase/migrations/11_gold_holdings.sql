-- =============================================================================
-- Personal Finance Tracker - Migration 11: Gold holdings (Investments · Gold)
-- =============================================================================
-- First asset class of the Investments feature: physical gold (coins, bars,
-- jewellery). Mirrors existing conventions:
--   * Money is BIGINT paise; weight is BIGINT milligrams (integers only).
--   * Soft deletes via deleted_at; shared set_updated_at() trigger.
--   * owner_id references profiles(id) (NULL = Shared / Family), validated to an
--     active family member exactly like accounts.owner_id / chits.owner_id.
--   * family_id on every row; RLS via is_family_member / can_edit_family.
--
-- gold_spot holds one editable "current 24k (999) rate" per family. Every
-- holding's live value is derived from it by fineness, so we only store one
-- number. A later phase auto-refreshes it (e.g. from GoodReturns).
--
-- Payment method / card are intentionally NOT stored here — that belongs to the
-- transactions ledger. Rewards (cashback / reward points / vouchers) are the
-- only benefits kept, and all are optional.
-- =============================================================================

-- ---- gold_holdings ----------------------------------------------------------
create table if not exists public.gold_holdings (
  id                     uuid primary key default gen_random_uuid(),
  family_id              uuid not null references public.families (id) on delete cascade,
  owner_id               uuid references public.profiles (id) on delete set null,
  form                   text not null check (form in ('coin', 'bar', 'jewellery')),
  name                   text check (name is null or char_length(name) <= 100),
  -- Fineness in parts-per-thousand: 999 = 24K, 916 = 22K, 750 = 18K, etc.
  fineness               integer not null check (fineness between 1 and 1000),
  -- Weight of ONE unit, in milligrams (1.000 g = 1000 mg).
  weight_mg              bigint not null check (weight_mg > 0),
  quantity               integer not null default 1 check (quantity > 0),
  purchase_date          date not null,
  -- Total amount actually paid for this line (all units), in paise.
  price_total_paise      bigint not null check (price_total_paise >= 0),
  -- Optional rewards (all paise, >= 0) that reduce the effective cost.
  cashback_paise         bigint not null default 0 check (cashback_paise >= 0),
  reward_value_paise     bigint not null default 0 check (reward_value_paise >= 0),
  voucher_savings_paise  bigint not null default 0 check (voucher_savings_paise >= 0),
  -- Store / provenance metadata.
  website                text,
  brand                  text,
  notes                  text,
  tags                   text[] not null default '{}',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);

-- Idempotent cleanup: drop columns an earlier draft of this migration created,
-- so re-running lands on the current shape whether or not it was applied before.
alter table public.gold_holdings drop column if exists payment_method;
alter table public.gold_holdings drop column if exists card;
alter table public.gold_holdings drop column if exists discount_paise;

-- ---- gold_spot (one current 24k rate per family) ----------------------------
create table if not exists public.gold_spot (
  family_id              uuid primary key references public.families (id) on delete cascade,
  -- Current 24K (999) rate in paise per gram; per-purity value is derived.
  price_paise_per_gram   bigint not null check (price_paise_per_gram > 0),
  source                 text,
  as_of                  timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

create index if not exists idx_gold_holdings_family
  on public.gold_holdings (family_id) where deleted_at is null;
create index if not exists idx_gold_holdings_owner
  on public.gold_holdings (owner_id) where deleted_at is null;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- A non-null owner must be an active member of the row's family. Mirrors
-- validate_account_owner() / validate_chit_owner().
create or replace function public.validate_gold_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is not null and not exists (
    select 1
    from public.family_members fm
    where fm.family_id = new.family_id
      and fm.user_id = new.owner_id
      and fm.deleted_at is null
  ) then
    raise exception 'Gold holding owner must be an active member of the family';
  end if;

  return new;
end;
$$;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

drop trigger if exists trg_validate_gold_owner on public.gold_holdings;
create trigger trg_validate_gold_owner
  before insert or update of family_id, owner_id on public.gold_holdings
  for each row execute function public.validate_gold_owner();

drop trigger if exists trg_set_updated_at on public.gold_holdings;
create trigger trg_set_updated_at
  before update on public.gold_holdings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.gold_spot;
create trigger trg_set_updated_at
  before update on public.gold_spot
  for each row execute function public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.gold_holdings enable row level security;
alter table public.gold_spot     enable row level security;

-- ---- gold_holdings ----------------------------------------------------------
drop policy if exists gold_holdings_select on public.gold_holdings;
create policy gold_holdings_select on public.gold_holdings
  for select using (public.is_family_member(family_id));
drop policy if exists gold_holdings_insert on public.gold_holdings;
create policy gold_holdings_insert on public.gold_holdings
  for insert with check (public.can_edit_family(family_id));
drop policy if exists gold_holdings_update on public.gold_holdings;
create policy gold_holdings_update on public.gold_holdings
  for update using (public.can_edit_family(family_id))
              with check (public.can_edit_family(family_id));
drop policy if exists gold_holdings_delete on public.gold_holdings;
create policy gold_holdings_delete on public.gold_holdings
  for delete using (public.can_edit_family(family_id));

-- ---- gold_spot --------------------------------------------------------------
drop policy if exists gold_spot_select on public.gold_spot;
create policy gold_spot_select on public.gold_spot
  for select using (public.is_family_member(family_id));
drop policy if exists gold_spot_insert on public.gold_spot;
create policy gold_spot_insert on public.gold_spot
  for insert with check (public.can_edit_family(family_id));
drop policy if exists gold_spot_update on public.gold_spot;
create policy gold_spot_update on public.gold_spot
  for update using (public.can_edit_family(family_id))
              with check (public.can_edit_family(family_id));

-- =============================================================================
-- End migration 11.
-- =============================================================================
