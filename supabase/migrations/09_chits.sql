-- =============================================================================
-- Personal Finance Tracker - Migration 09: Chits (Chit Funds)
-- =============================================================================
-- Adds two family-scoped tables for tracking chit funds and their monthly
-- payments. Everything mirrors existing conventions:
--   * Money is stored as BIGINT paise.
--   * Soft deletes use deleted_at (NULL = active row).
--   * created_at / updated_at use the shared set_updated_at() trigger.
--   * owner_id references profiles(id) on delete set null, exactly like
--     accounts.owner_id (NULL = Shared / Family). A non-null owner must be an
--     active member of the family, enforced like validate_account_owner().
--   * Every table carries its own family_id; RLS reads directly off it using
--     is_family_member (select) and can_edit_family (insert/update/delete),
--     matching accounts / budgets / transactions.
--   * chit_payments.family_id is denormalized (like every other child table).
--     A trigger keeps it consistent with the parent chit's family, mirroring
--     validate_budget() / validate_txn_references().
-- =============================================================================

-- =============================================================================
-- TABLES
-- =============================================================================

-- ---- chits ------------------------------------------------------------------
create table if not exists public.chits (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families (id) on delete cascade,
  owner_id         uuid references public.profiles (id) on delete set null,
  name             text not null check (char_length(name) between 1 and 100),
  chit_value       bigint not null check (chit_value > 0),
  tenure_months    integer not null check (tenure_months > 0),
  start_date       date not null,
  organizer        text,
  notes            text,
  received_month   integer,
  received_amount  bigint,
  status           text not null default 'active'
                     check (status in ('active', 'completed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  constraint chits_received_month_range_check check (
    received_month is null
    or (received_month >= 1 and received_month <= tenure_months)
  ),
  constraint chits_received_pair_check check (
    (received_month is null and received_amount is null)
    or (received_month is not null and received_amount is not null)
  )
);

-- ---- chit_payments ----------------------------------------------------------
create table if not exists public.chit_payments (
  id            uuid primary key default gen_random_uuid(),
  chit_id       uuid not null references public.chits (id) on delete cascade,
  family_id     uuid not null references public.families (id) on delete cascade,
  month_number  integer not null check (month_number >= 1),
  amount_paid   bigint not null check (amount_paid >= 0),
  payment_date  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- =============================================================================
-- INDEXES
-- =============================================================================

create index if not exists idx_chits_family
  on public.chits (family_id) where deleted_at is null;
create index if not exists idx_chits_owner
  on public.chits (owner_id) where deleted_at is null;
create index if not exists idx_chit_payments_chit
  on public.chit_payments (chit_id) where deleted_at is null;
create index if not exists idx_chit_payments_family
  on public.chit_payments (family_id) where deleted_at is null;

-- One payment row per month per chit (ignoring soft-deleted rows).
create unique index if not exists chit_payments_unique_month
  on public.chit_payments (chit_id, month_number)
  where deleted_at is null;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Keep chit ownership scoped to the same family. A non-null owner must be an
-- active member of the chit's family. Mirrors validate_account_owner().
create or replace function public.validate_chit_owner()
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
    raise exception 'Chit owner must be an active member of the family';
  end if;

  return new;
end;
$$;

-- Keep a payment's denormalized family_id consistent with its parent chit.
-- Mirrors validate_budget() / validate_txn_references().
create or replace function public.validate_chit_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.chits c
    where c.id = new.chit_id
      and c.family_id = new.family_id
      and c.deleted_at is null
  ) then
    raise exception 'chit % does not belong to family %', new.chit_id, new.family_id;
  end if;

  return new;
end;
$$;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

drop trigger if exists trg_validate_chit_owner on public.chits;
create trigger trg_validate_chit_owner
  before insert or update of family_id, owner_id on public.chits
  for each row execute function public.validate_chit_owner();

drop trigger if exists trg_chit_payment_validate on public.chit_payments;
create trigger trg_chit_payment_validate
  before insert or update on public.chit_payments
  for each row execute function public.validate_chit_payment();

drop trigger if exists trg_set_updated_at on public.chits;
create trigger trg_set_updated_at
  before update on public.chits
  for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.chit_payments;
create trigger trg_set_updated_at
  before update on public.chit_payments
  for each row execute function public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.chits         enable row level security;
alter table public.chit_payments enable row level security;

-- ---- chits ------------------------------------------------------------------
drop policy if exists chits_select on public.chits;
create policy chits_select on public.chits
  for select using (public.is_family_member(family_id));
drop policy if exists chits_insert on public.chits;
create policy chits_insert on public.chits
  for insert with check (public.can_edit_family(family_id));
drop policy if exists chits_update on public.chits;
create policy chits_update on public.chits
  for update using (public.can_edit_family(family_id))
              with check (public.can_edit_family(family_id));
drop policy if exists chits_delete on public.chits;
create policy chits_delete on public.chits
  for delete using (public.can_edit_family(family_id));

-- ---- chit_payments ----------------------------------------------------------
drop policy if exists chit_payments_select on public.chit_payments;
create policy chit_payments_select on public.chit_payments
  for select using (public.is_family_member(family_id));
drop policy if exists chit_payments_insert on public.chit_payments;
create policy chit_payments_insert on public.chit_payments
  for insert with check (public.can_edit_family(family_id));
drop policy if exists chit_payments_update on public.chit_payments;
create policy chit_payments_update on public.chit_payments
  for update using (public.can_edit_family(family_id))
              with check (public.can_edit_family(family_id));
drop policy if exists chit_payments_delete on public.chit_payments;
create policy chit_payments_delete on public.chit_payments
  for delete using (public.can_edit_family(family_id));

-- =============================================================================
-- End migration 09.
-- =============================================================================
