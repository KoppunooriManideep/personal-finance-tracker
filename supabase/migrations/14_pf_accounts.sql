-- =============================================================================
-- Personal Finance Tracker - Migration 14: Provident Fund accounts
-- =============================================================================
-- PF (EPF / PPF / VPF / NPS) can't be auto-fetched (EPFO is auth-gated), so we
-- track it as a manually-anchored balance that the app projects forward:
--   projected = balance + monthly_contribution × (months since as_of) + interest
-- The user reconciles occasionally by editing balance + as_of (the "as of" date
-- is the anchor — the contribution/interest only apply forward from it, so past
-- months are already inside the entered balance). Money is BIGINT paise.
--   * owner_id / soft delete / family RLS mirror accounts, chits, gold_holdings.
-- =============================================================================

create table if not exists public.pf_accounts (
  id                          uuid primary key default gen_random_uuid(),
  family_id                   uuid not null references public.families (id) on delete cascade,
  owner_id                    uuid references public.profiles (id) on delete set null,
  kind                        text not null default 'epf'
                                check (kind in ('epf', 'ppf', 'vpf', 'nps')),
  name                        text check (name is null or char_length(name) <= 120),
  -- Last known/corrected balance, accurate as of `as_of`.
  balance_paise               bigint not null check (balance_paise >= 0),
  as_of                       date not null,
  monthly_contribution_paise  bigint not null default 0
                                check (monthly_contribution_paise >= 0),
  -- Optional annual interest rate (percent), e.g. 8.25.
  annual_rate                 numeric(5,2) not null default 0
                                check (annual_rate >= 0 and annual_rate <= 100),
  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted_at                  timestamptz
);

create index if not exists idx_pf_accounts_family
  on public.pf_accounts (family_id) where deleted_at is null;
create index if not exists idx_pf_accounts_owner
  on public.pf_accounts (owner_id) where deleted_at is null;

-- Owner must be an active family member. Mirrors validate_gold_owner().
create or replace function public.validate_pf_owner()
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
    raise exception 'PF account owner must be an active member of the family';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_pf_owner on public.pf_accounts;
create trigger trg_validate_pf_owner
  before insert or update of family_id, owner_id on public.pf_accounts
  for each row execute function public.validate_pf_owner();

drop trigger if exists trg_set_updated_at on public.pf_accounts;
create trigger trg_set_updated_at
  before update on public.pf_accounts
  for each row execute function public.set_updated_at();

alter table public.pf_accounts enable row level security;

drop policy if exists pf_accounts_select on public.pf_accounts;
create policy pf_accounts_select on public.pf_accounts
  for select using (public.is_family_member(family_id));
drop policy if exists pf_accounts_insert on public.pf_accounts;
create policy pf_accounts_insert on public.pf_accounts
  for insert with check (public.can_edit_family(family_id));
drop policy if exists pf_accounts_update on public.pf_accounts;
create policy pf_accounts_update on public.pf_accounts
  for update using (public.can_edit_family(family_id))
              with check (public.can_edit_family(family_id));
drop policy if exists pf_accounts_delete on public.pf_accounts;
create policy pf_accounts_delete on public.pf_accounts
  for delete using (public.can_edit_family(family_id));

-- =============================================================================
-- End migration 14.
-- =============================================================================
