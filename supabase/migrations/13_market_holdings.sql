-- =============================================================================
-- Personal Finance Tracker - Migration 13: Market holdings (Stocks + MFs)
-- =============================================================================
-- Stocks and mutual funds share the same shape: quantity + amount invested, with
-- a live price fetched at read time (never stored stale). One table with a `kind`
-- discriminator keeps it simple.
--   * ISIN is the universal identifier: INF… = mutual fund, INE… = equity/stock.
--     MF NAV is looked up by ISIN (AMFI NAVAll.txt); stock quotes by `symbol`
--     (Yahoo Finance, e.g. RELIANCE.NS).
--   * Money is BIGINT paise; `quantity` is NUMERIC (shares can be whole, MF units
--     are fractional). invested_paise is the total cost (avg price × qty).
--   * owner_id / soft delete / family RLS mirror accounts, chits, gold_holdings.
-- =============================================================================

create table if not exists public.market_holdings (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  owner_id        uuid references public.profiles (id) on delete set null,
  kind            text not null check (kind in ('stock', 'mutual_fund')),
  -- Universal id (INE… = stock, INF… = MF). Used for MF NAV lookup by ISIN.
  isin            text,
  -- Stock trading symbol (RELIANCE) or MF scheme/fund name.
  symbol          text not null check (char_length(symbol) between 1 and 200),
  -- 'NSE' | 'BSE' for stocks; null for mutual funds.
  exchange        text check (exchange is null or exchange in ('NSE', 'BSE')),
  -- Display name (company / scheme); may equal symbol.
  name            text,
  quantity        numeric(20, 4) not null check (quantity > 0),
  -- Total amount invested (avg price × quantity), in paise.
  invested_paise  bigint not null check (invested_paise >= 0),
  notes           text,
  tags            text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists idx_market_holdings_family
  on public.market_holdings (family_id) where deleted_at is null;
create index if not exists idx_market_holdings_owner
  on public.market_holdings (owner_id) where deleted_at is null;
create index if not exists idx_market_holdings_kind
  on public.market_holdings (family_id, kind) where deleted_at is null;

-- Owner must be an active family member. Mirrors validate_gold_owner().
create or replace function public.validate_market_owner()
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
    raise exception 'Market holding owner must be an active member of the family';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_market_owner on public.market_holdings;
create trigger trg_validate_market_owner
  before insert or update of family_id, owner_id on public.market_holdings
  for each row execute function public.validate_market_owner();

drop trigger if exists trg_set_updated_at on public.market_holdings;
create trigger trg_set_updated_at
  before update on public.market_holdings
  for each row execute function public.set_updated_at();

alter table public.market_holdings enable row level security;

drop policy if exists market_holdings_select on public.market_holdings;
create policy market_holdings_select on public.market_holdings
  for select using (public.is_family_member(family_id));
drop policy if exists market_holdings_insert on public.market_holdings;
create policy market_holdings_insert on public.market_holdings
  for insert with check (public.can_edit_family(family_id));
drop policy if exists market_holdings_update on public.market_holdings;
create policy market_holdings_update on public.market_holdings
  for update using (public.can_edit_family(family_id))
              with check (public.can_edit_family(family_id));
drop policy if exists market_holdings_delete on public.market_holdings;
create policy market_holdings_delete on public.market_holdings
  for delete using (public.can_edit_family(family_id));

-- =============================================================================
-- End migration 13.
-- =============================================================================
