-- =============================================================================
-- Personal Finance Tracker - Migration 08: Account Owner
-- =============================================================================
-- Adds an optional owner to accounts so balances can be grouped by family
-- member. owner_id references profiles.id because profile rows are the app's
-- joinable user metadata layer (name/avatar), while profiles.id remains tied
-- one-to-one to auth.users.id.
--
-- NULL owner_id means the account is shared by the family.
-- =============================================================================

alter table public.accounts
  add column if not exists owner_id uuid references public.profiles (id) on delete set null;

create index if not exists idx_accounts_owner
  on public.accounts (owner_id) where deleted_at is null;

-- Keep account ownership scoped to the same family. A non-null owner must be
-- an active member of the account's family.
create or replace function public.validate_account_owner()
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
    raise exception 'Account owner must be an active member of the family';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_account_owner on public.accounts;
create trigger trg_validate_account_owner
  before insert or update of family_id, owner_id on public.accounts
  for each row execute function public.validate_account_owner();

-- Refresh the balance view so consumers can read owner_id from the same source
-- they already use for current balances.
create or replace view public.account_balances
with (security_invoker = on) as
select
  a.id as account_id,
  a.family_id,
  a.name,
  a.type,
  a.opening_balance,
  a.opening_balance
    + coalesce((
        select sum(t.amount)
        from public.transactions t
        where t.account_id = a.id
          and t.type = 'income'
          and t.deleted_at is null
      ), 0)
    - coalesce((
        select sum(t.amount)
        from public.transactions t
        where t.account_id = a.id
          and t.type = 'expense'
          and t.deleted_at is null
      ), 0)
    + coalesce((
        select sum(t.amount)
        from public.transactions t
        where t.to_account_id = a.id
          and t.type = 'transfer'
          and t.deleted_at is null
      ), 0)
    - coalesce((
        select sum(t.amount)
        from public.transactions t
        where t.from_account_id = a.id
          and t.type = 'transfer'
          and t.deleted_at is null
      ), 0)
    as current_balance,
  a.owner_id
from public.accounts a
where a.deleted_at is null;

-- Template for existing accounts:
-- Replace the account names and owner UUIDs with your real values. Use NULL
-- for shared family accounts.
--
-- update public.accounts
-- set owner_id = case name
--   when 'HDFC Savings' then '00000000-0000-0000-0000-000000000000'::uuid
--   when 'Cash' then null
--   else owner_id
-- end
-- where family_id = '11111111-1111-1111-1111-111111111111'::uuid
--   and deleted_at is null;

-- =============================================================================
-- End migration 08.
-- =============================================================================
