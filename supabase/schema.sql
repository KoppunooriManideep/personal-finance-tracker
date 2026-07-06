-- =============================================================================
-- Personal Finance Tracker — Phase 1 Schema (Supabase / PostgreSQL)
-- =============================================================================
-- Run this whole file in the Supabase SQL Editor.
--
-- Conventions:
--   * Money is stored as BIGINT paise (rupees * 100). Always positive.
--   * All timestamps are timestamptz, stored in UTC (display in IST client-side).
--   * Soft deletes via `deleted_at` (NULL = active row).
--   * Every table is protected by Row Level Security (RLS). Users can only
--     touch rows belonging to a family they are a member of.
--   * Roles: owner (full control), member (read/write), viewer (read only).
--   * Transactions have THREE types: income, expense, transfer.
--       - income/expense use account_id + category_id
--       - transfer uses from_account_id + to_account_id (different accounts)
--       - transfers NEVER carry a category and are excluded from income/
--         expense/budget/category math (enforced by column constraints).
-- =============================================================================

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- =============================================================================
-- 1. GENERIC HELPERS
-- =============================================================================

-- Keeps `updated_at` fresh on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- ---- families --------------------------------------------------------------
create table if not exists public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 100),
  created_by  uuid not null references auth.users (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ---- family_members --------------------------------------------------------
-- Links auth users to a family with a role. This table drives all RLS checks.
create table if not exists public.family_members (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member'
                 check (role in ('owner', 'member', 'viewer')),
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (family_id, user_id)
);

-- ---- accounts --------------------------------------------------------------
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 100),
  type            text not null
                    check (type in ('cash', 'bank', 'credit_card', 'wallet')),
  opening_balance bigint not null default 0,   -- paise; may be negative for credit cards
  currency        text not null default 'INR',
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- ---- categories ------------------------------------------------------------
-- Categories are strictly income OR expense. Transfers never use categories.
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  kind        text not null check (kind in ('income', 'expense')),
  icon        text,   -- lucide-react icon name
  color       text,   -- hex, e.g. #22c55e
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- One active category name per (family, kind).
create unique index if not exists categories_unique_name
  on public.categories (family_id, kind, lower(name))
  where deleted_at is null;

-- ---- transactions ----------------------------------------------------------
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  type            text not null
                    check (type in ('income', 'expense', 'transfer')),
  amount          bigint not null check (amount > 0),   -- paise, always positive
  occurred_at     timestamptz not null default now(),   -- UTC; display in IST
  note            text,

  -- income / expense fields
  account_id      uuid references public.accounts (id) on delete restrict,
  category_id     uuid references public.categories (id) on delete restrict,

  -- transfer fields
  from_account_id uuid references public.accounts (id) on delete restrict,
  to_account_id   uuid references public.accounts (id) on delete restrict,

  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  -- Enforce the shape of each transaction type at the row level.
  constraint transactions_type_fields_check check (
    (
      type in ('income', 'expense')
      and account_id is not null
      and category_id is not null
      and from_account_id is null
      and to_account_id is null
    )
    or (
      type = 'transfer'
      and from_account_id is not null
      and to_account_id is not null
      and from_account_id <> to_account_id
      and account_id is null
      and category_id is null
    )
  )
);

-- ---- budgets ---------------------------------------------------------------
-- Monthly limit per (expense) category. period_month is the 1st of the month.
create table if not exists public.budgets (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  category_id  uuid not null references public.categories (id) on delete cascade,
  amount       bigint not null check (amount >= 0),   -- paise limit
  period_month date not null,                         -- must be day 1 (see trigger)
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- One active budget per (family, category, month).
create unique index if not exists budgets_unique_period
  on public.budgets (family_id, category_id, period_month)
  where deleted_at is null;

-- ---- recurring_transactions ------------------------------------------------
-- Templates that generate transactions (rent, salary, subscriptions...).
-- Same three-type shape as transactions.
create table if not exists public.recurring_transactions (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  type            text not null
                    check (type in ('income', 'expense', 'transfer')),
  amount          bigint not null check (amount > 0),
  note            text,

  account_id      uuid references public.accounts (id) on delete restrict,
  category_id     uuid references public.categories (id) on delete restrict,
  from_account_id uuid references public.accounts (id) on delete restrict,
  to_account_id   uuid references public.accounts (id) on delete restrict,

  frequency       text not null
                    check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  interval_count  integer not null default 1 check (interval_count >= 1),
  start_date      date not null,
  end_date        date,
  next_run_date   date not null,
  is_active       boolean not null default true,

  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint recurring_type_fields_check check (
    (
      type in ('income', 'expense')
      and account_id is not null
      and category_id is not null
      and from_account_id is null
      and to_account_id is null
    )
    or (
      type = 'transfer'
      and from_account_id is not null
      and to_account_id is not null
      and from_account_id <> to_account_id
      and account_id is null
      and category_id is null
    )
  ),
  constraint recurring_end_after_start check (end_date is null or end_date >= start_date)
);

-- =============================================================================
-- 3. INDEXES (common query paths)
-- =============================================================================

create index if not exists idx_family_members_user      on public.family_members (user_id) where deleted_at is null;
create index if not exists idx_family_members_family     on public.family_members (family_id) where deleted_at is null;

create index if not exists idx_accounts_family           on public.accounts (family_id) where deleted_at is null;

create index if not exists idx_categories_family_kind    on public.categories (family_id, kind) where deleted_at is null;

create index if not exists idx_txn_family_date           on public.transactions (family_id, occurred_at desc) where deleted_at is null;
create index if not exists idx_txn_account               on public.transactions (account_id) where deleted_at is null;
create index if not exists idx_txn_category              on public.transactions (category_id) where deleted_at is null;
create index if not exists idx_txn_from_account          on public.transactions (from_account_id) where deleted_at is null;
create index if not exists idx_txn_to_account            on public.transactions (to_account_id) where deleted_at is null;
create index if not exists idx_txn_type                  on public.transactions (family_id, type) where deleted_at is null;

create index if not exists idx_budgets_family_period     on public.budgets (family_id, period_month) where deleted_at is null;

create index if not exists idx_recurring_family          on public.recurring_transactions (family_id) where deleted_at is null;
create index if not exists idx_recurring_next_run        on public.recurring_transactions (next_run_date) where is_active and deleted_at is null;

-- =============================================================================
-- 4. RLS HELPER FUNCTIONS
-- =============================================================================
-- SECURITY DEFINER so they bypass RLS on family_members. This is REQUIRED to
-- avoid infinite recursion when family_members' own policies check membership.

-- Is the current user an active member of this family?
create or replace function public.is_family_member(_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = _family_id
      and fm.user_id = auth.uid()
      and fm.deleted_at is null
  );
$$;

-- Is the current user the owner of this family?
create or replace function public.is_family_owner(_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = _family_id
      and fm.user_id = auth.uid()
      and fm.role = 'owner'
      and fm.deleted_at is null
  );
$$;

-- Can the current user write in this family? (owner or member, not viewer)
create or replace function public.can_edit_family(_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = _family_id
      and fm.user_id = auth.uid()
      and fm.role in ('owner', 'member')
      and fm.deleted_at is null
  );
$$;

-- =============================================================================
-- 5. BUSINESS TRIGGERS
-- =============================================================================

-- ---- 5a. Seed default Indian categories ------------------------------------
create or replace function public.seed_default_categories(_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (family_id, name, kind, icon, color, is_default)
  values
    -- Income
    (_family_id, 'Salary',          'income',  'wallet',        '#22c55e', true),
    (_family_id, 'Business',         'income',  'briefcase',     '#16a34a', true),
    (_family_id, 'Freelance',        'income',  'laptop',        '#4ade80', true),
    (_family_id, 'Interest',         'income',  'piggy-bank',    '#10b981', true),
    (_family_id, 'Rental Income',    'income',  'home',          '#34d399', true),
    (_family_id, 'Gifts',            'income',  'gift',          '#a3e635', true),
    (_family_id, 'Refunds',          'income',  'rotate-ccw',    '#84cc16', true),
    (_family_id, 'Other Income',     'income',  'circle-plus',   '#65a30d', true),
    -- Expense
    (_family_id, 'Groceries',        'expense', 'shopping-cart', '#ef4444', true),
    (_family_id, 'Rent',             'expense', 'home',          '#f97316', true),
    (_family_id, 'Utilities',        'expense', 'plug',          '#f59e0b', true),
    (_family_id, 'Mobile & Internet','expense', 'smartphone',    '#eab308', true),
    (_family_id, 'Transport & Fuel', 'expense', 'fuel',          '#f43f5e', true),
    (_family_id, 'Dining Out',       'expense', 'utensils',      '#ec4899', true),
    (_family_id, 'Shopping',         'expense', 'shopping-bag',  '#d946ef', true),
    (_family_id, 'Health & Medical', 'expense', 'heart-pulse',   '#a855f7', true),
    (_family_id, 'Education',        'expense', 'graduation-cap','#8b5cf6', true),
    (_family_id, 'Entertainment',    'expense', 'clapperboard',  '#6366f1', true),
    (_family_id, 'EMI & Loans',      'expense', 'landmark',      '#3b82f6', true),
    (_family_id, 'Insurance',        'expense', 'shield-check',  '#0ea5e9', true),
    (_family_id, 'Domestic Help',    'expense', 'brush',         '#06b6d4', true),
    (_family_id, 'Travel',           'expense', 'plane',         '#14b8a6', true),
    (_family_id, 'Personal Care',    'expense', 'scissors',      '#f472b6', true),
    (_family_id, 'Kids',             'expense', 'baby',          '#fb923c', true),
    (_family_id, 'Charity & Donations','expense','hand-heart',   '#94a3b8', true),
    (_family_id, 'Taxes',            'expense', 'receipt',       '#64748b', true),
    (_family_id, 'Other Expense',    'expense', 'circle-minus',  '#6b7280', true)
  on conflict do nothing;
end;
$$;

-- ---- 5b. On new family: create owner membership + seed categories ----------
create or replace function public.handle_new_family()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.family_members (family_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (family_id, user_id) do nothing;

  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

drop trigger if exists trg_family_after_insert on public.families;
create trigger trg_family_after_insert
  after insert on public.families
  for each row execute function public.handle_new_family();

-- ---- 5c. Validate transaction / recurring references -----------------------
-- CHECK constraints can't run subqueries, so a trigger enforces that referenced
-- accounts/categories belong to the SAME family, and category kind matches type.
create or replace function public.validate_txn_references()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type in ('income', 'expense') then
    if not exists (
      select 1 from public.accounts a
      where a.id = new.account_id and a.family_id = new.family_id and a.deleted_at is null
    ) then
      raise exception 'account % does not belong to family %', new.account_id, new.family_id;
    end if;

    if not exists (
      select 1 from public.categories c
      where c.id = new.category_id and c.family_id = new.family_id
        and c.kind = new.type and c.deleted_at is null
    ) then
      raise exception 'category % is not a valid % category for family %',
        new.category_id, new.type, new.family_id;
    end if;

  elsif new.type = 'transfer' then
    if not exists (
      select 1 from public.accounts a
      where a.id = new.from_account_id and a.family_id = new.family_id and a.deleted_at is null
    ) then
      raise exception 'from_account % does not belong to family %', new.from_account_id, new.family_id;
    end if;

    if not exists (
      select 1 from public.accounts a
      where a.id = new.to_account_id and a.family_id = new.family_id and a.deleted_at is null
    ) then
      raise exception 'to_account % does not belong to family %', new.to_account_id, new.family_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_txn_validate on public.transactions;
create trigger trg_txn_validate
  before insert or update on public.transactions
  for each row execute function public.validate_txn_references();

drop trigger if exists trg_recurring_validate on public.recurring_transactions;
create trigger trg_recurring_validate
  before insert or update on public.recurring_transactions
  for each row execute function public.validate_txn_references();

-- ---- 5d. Validate budget references ----------------------------------------
-- Budgets only make sense for expense categories in the same family.
create or replace function public.validate_budget()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Normalize to first of month.
  new.period_month := date_trunc('month', new.period_month)::date;

  if not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.family_id = new.family_id
      and c.kind = 'expense' and c.deleted_at is null
  ) then
    raise exception 'budget category % must be an expense category in family %',
      new.category_id, new.family_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_budget_validate on public.budgets;
create trigger trg_budget_validate
  before insert or update on public.budgets
  for each row execute function public.validate_budget();

-- ---- 5e. updated_at triggers for every table -------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'families', 'family_members', 'accounts', 'categories',
    'transactions', 'budgets', 'recurring_transactions'
  ]
  loop
    execute format('drop trigger if exists trg_set_updated_at on public.%I;', t);
    execute format(
      'create trigger trg_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t);
  end loop;
end;
$$;

-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- =============================================================================

alter table public.families               enable row level security;
alter table public.family_members         enable row level security;
alter table public.accounts               enable row level security;
alter table public.categories             enable row level security;
alter table public.transactions           enable row level security;
alter table public.budgets                enable row level security;
alter table public.recurring_transactions enable row level security;

-- ---- families --------------------------------------------------------------
drop policy if exists families_select on public.families;
create policy families_select on public.families
  for select using (public.is_family_member(id));

-- Any authenticated user may create a family (they become owner via trigger).
drop policy if exists families_insert on public.families;
create policy families_insert on public.families
  for insert with check (created_by = auth.uid());

drop policy if exists families_update on public.families;
create policy families_update on public.families
  for update using (public.is_family_owner(id))
              with check (public.is_family_owner(id));

drop policy if exists families_delete on public.families;
create policy families_delete on public.families
  for delete using (public.is_family_owner(id));

-- ---- family_members --------------------------------------------------------
-- Members can see co-members of their families.
drop policy if exists family_members_select on public.family_members;
create policy family_members_select on public.family_members
  for select using (public.is_family_member(family_id));

-- Owner can add members; a user may add themselves (join flow).
drop policy if exists family_members_insert on public.family_members;
create policy family_members_insert on public.family_members
  for insert with check (
    public.is_family_owner(family_id) or user_id = auth.uid()
  );

-- Owner manages roles; a user may edit their own row (e.g. display_name).
drop policy if exists family_members_update on public.family_members;
create policy family_members_update on public.family_members
  for update using (public.is_family_owner(family_id) or user_id = auth.uid())
              with check (public.is_family_owner(family_id) or user_id = auth.uid());

-- Owner may remove members; a user may leave (delete their own row).
drop policy if exists family_members_delete on public.family_members;
create policy family_members_delete on public.family_members
  for delete using (public.is_family_owner(family_id) or user_id = auth.uid());

-- ---- generic family-scoped tables ------------------------------------------
-- accounts, categories, transactions, budgets, recurring_transactions all share
-- the same pattern: read = member, write = owner/member (viewers are read-only).

-- accounts
drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts
  for select using (public.is_family_member(family_id));
drop policy if exists accounts_insert on public.accounts;
create policy accounts_insert on public.accounts
  for insert with check (public.can_edit_family(family_id));
drop policy if exists accounts_update on public.accounts;
create policy accounts_update on public.accounts
  for update using (public.can_edit_family(family_id))
              with check (public.can_edit_family(family_id));
drop policy if exists accounts_delete on public.accounts;
create policy accounts_delete on public.accounts
  for delete using (public.can_edit_family(family_id));

-- categories
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select using (public.is_family_member(family_id));
drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories
  for insert with check (public.can_edit_family(family_id));
drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories
  for update using (public.can_edit_family(family_id))
              with check (public.can_edit_family(family_id));
drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories
  for delete using (public.can_edit_family(family_id));

-- transactions
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select using (public.is_family_member(family_id));
drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions
  for insert with check (public.can_edit_family(family_id));
drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update using (public.can_edit_family(family_id))
              with check (public.can_edit_family(family_id));
drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions
  for delete using (public.can_edit_family(family_id));

-- budgets
drop policy if exists budgets_select on public.budgets;
create policy budgets_select on public.budgets
  for select using (public.is_family_member(family_id));
drop policy if exists budgets_insert on public.budgets;
create policy budgets_insert on public.budgets
  for insert with check (public.can_edit_family(family_id));
drop policy if exists budgets_update on public.budgets;
create policy budgets_update on public.budgets
  for update using (public.can_edit_family(family_id))
              with check (public.can_edit_family(family_id));
drop policy if exists budgets_delete on public.budgets;
create policy budgets_delete on public.budgets
  for delete using (public.can_edit_family(family_id));

-- recurring_transactions
drop policy if exists recurring_select on public.recurring_transactions;
create policy recurring_select on public.recurring_transactions
  for select using (public.is_family_member(family_id));
drop policy if exists recurring_insert on public.recurring_transactions;
create policy recurring_insert on public.recurring_transactions
  for insert with check (public.can_edit_family(family_id));
drop policy if exists recurring_update on public.recurring_transactions;
create policy recurring_update on public.recurring_transactions
  for update using (public.can_edit_family(family_id))
              with check (public.can_edit_family(family_id));
drop policy if exists recurring_delete on public.recurring_transactions;
create policy recurring_delete on public.recurring_transactions
  for delete using (public.can_edit_family(family_id));

-- =============================================================================
-- 7. ACCOUNT BALANCES VIEW (transfers reflected here ONLY)
-- =============================================================================
-- Balance = opening_balance
--         + income into the account
--         - expense from the account
--         + transfers received
--         - transfers sent
-- security_invoker = on so the view respects the querying user's RLS.
create or replace view public.account_balances
with (security_invoker = on) as
select
  a.id          as account_id,
  a.family_id,
  a.name,
  a.type,
  a.opening_balance,
  a.opening_balance
    + coalesce((
        select sum(t.amount)
        from public.transactions t
        where t.account_id = a.id and t.type = 'income' and t.deleted_at is null
      ), 0)
    - coalesce((
        select sum(t.amount)
        from public.transactions t
        where t.account_id = a.id and t.type = 'expense' and t.deleted_at is null
      ), 0)
    + coalesce((
        select sum(t.amount)
        from public.transactions t
        where t.to_account_id = a.id and t.type = 'transfer' and t.deleted_at is null
      ), 0)
    - coalesce((
        select sum(t.amount)
        from public.transactions t
        where t.from_account_id = a.id and t.type = 'transfer' and t.deleted_at is null
      ), 0)
    as current_balance
from public.accounts a
where a.deleted_at is null;

-- =============================================================================
-- End of Phase 1 schema.
-- =============================================================================
