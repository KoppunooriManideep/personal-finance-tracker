-- =============================================================================
-- Personal Finance Tracker - Consolidated Fresh Deployment Schema
-- =============================================================================
-- Run this file on a FRESH empty Supabase database.
--
-- Conventions:
--   * Money is stored as BIGINT paise (rupees * 100).
--   * All timestamps are timestamptz, stored in UTC.
--   * Soft deletes use deleted_at (NULL = active row).
--   * Google auth only; profile rows are synced from auth.users metadata.
--   * Families are shared; RLS restricts data to active family members.
--   * Transfers never use categories and are excluded from income/expense,
--     budget, category, and dashboard reporting calculations.
-- =============================================================================

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

create extension if not exists pgcrypto;

-- =============================================================================
-- TABLES
-- =============================================================================

-- ---- profiles --------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Public profile data synced from auth.users Google metadata.';
comment on column public.profiles.id is
  'Matches auth.users.id.';
comment on column public.profiles.full_name is
  'Display name from Google raw_user_meta_data.full_name.';
comment on column public.profiles.avatar_url is
  'Avatar URL from Google raw_user_meta_data.avatar_url.';
comment on column public.profiles.updated_at is
  'Last time this profile row was updated.';

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
create table if not exists public.family_members (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          text not null default 'member'
                  check (role in ('owner', 'member', 'viewer')),
  display_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (family_id, user_id),
  constraint family_members_user_id_profiles_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade
);

-- ---- accounts --------------------------------------------------------------
create table if not exists public.accounts (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 100),
  type             text not null
                     check (type in ('cash', 'bank', 'credit_card', 'wallet')),
  opening_balance  bigint not null default 0,
  currency         text not null default 'INR',
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

-- ---- categories ------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  kind        text not null check (kind in ('income', 'expense')),
  icon        text,
  color       text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ---- transactions ----------------------------------------------------------
create table if not exists public.transactions (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families (id) on delete cascade,
  type             text not null
                     check (type in ('income', 'expense', 'transfer')),
  amount           bigint not null check (amount > 0),
  occurred_at      timestamptz not null default now(),
  note             text,

  account_id       uuid references public.accounts (id) on delete restrict,
  category_id      uuid references public.categories (id) on delete restrict,
  from_account_id  uuid references public.accounts (id) on delete restrict,
  to_account_id    uuid references public.accounts (id) on delete restrict,

  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  constraint transactions_created_by_profiles_fkey
    foreign key (created_by) references public.profiles (id) on delete set null,
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
create table if not exists public.budgets (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  category_id   uuid not null references public.categories (id) on delete cascade,
  amount        bigint not null check (amount >= 0),
  period_month  date not null,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- ---- recurring_transactions ------------------------------------------------
create table if not exists public.recurring_transactions (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families (id) on delete cascade,
  type             text not null
                     check (type in ('income', 'expense', 'transfer')),
  amount           bigint not null check (amount > 0),
  note             text,

  account_id       uuid references public.accounts (id) on delete restrict,
  category_id      uuid references public.categories (id) on delete restrict,
  from_account_id  uuid references public.accounts (id) on delete restrict,
  to_account_id    uuid references public.accounts (id) on delete restrict,

  frequency        text not null
                     check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  interval_count   integer not null default 1 check (interval_count >= 1),
  start_date       date not null,
  end_date         date,
  next_run_date    date not null,
  is_active        boolean not null default true,

  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

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

-- ---- family_invites --------------------------------------------------------
create table if not exists public.family_invites (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  code        text not null unique,
  created_by  uuid references auth.users (id) on delete set null,
  expires_at  timestamptz,
  max_uses    integer,
  used_count  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- =============================================================================
-- INDEXES
-- =============================================================================

create unique index if not exists categories_unique_name
  on public.categories (family_id, kind, lower(name))
  where deleted_at is null;

create unique index if not exists budgets_unique_period
  on public.budgets (family_id, category_id, period_month)
  where deleted_at is null;

create index if not exists idx_family_members_user
  on public.family_members (user_id) where deleted_at is null;
create index if not exists idx_family_members_family
  on public.family_members (family_id) where deleted_at is null;
create index if not exists idx_accounts_family
  on public.accounts (family_id) where deleted_at is null;
create index if not exists idx_categories_family_kind
  on public.categories (family_id, kind) where deleted_at is null;
create index if not exists idx_txn_family_date
  on public.transactions (family_id, occurred_at desc) where deleted_at is null;
create index if not exists idx_txn_account
  on public.transactions (account_id) where deleted_at is null;
create index if not exists idx_txn_category
  on public.transactions (category_id) where deleted_at is null;
create index if not exists idx_txn_from_account
  on public.transactions (from_account_id) where deleted_at is null;
create index if not exists idx_txn_to_account
  on public.transactions (to_account_id) where deleted_at is null;
create index if not exists idx_txn_type
  on public.transactions (family_id, type) where deleted_at is null;
create index if not exists idx_budgets_family_period
  on public.budgets (family_id, period_month) where deleted_at is null;
create index if not exists idx_recurring_family
  on public.recurring_transactions (family_id) where deleted_at is null;
create index if not exists idx_recurring_next_run
  on public.recurring_transactions (next_run_date)
  where is_active and deleted_at is null;
create index if not exists idx_family_invites_family
  on public.family_invites (family_id) where deleted_at is null;
create index if not exists idx_family_invites_code
  on public.family_invites (code) where deleted_at is null;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- ---- generic updated_at helper --------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---- profile sync ----------------------------------------------------------
create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();

  return new;
end;
$$;

-- Backfill any existing users if this file is run after auth users already exist.
insert into public.profiles (id, full_name, avatar_url)
select
  u.id,
  u.raw_user_meta_data ->> 'full_name',
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do update
  set full_name = excluded.full_name,
      avatar_url = excluded.avatar_url,
      updated_at = now();

-- ---- RLS helper functions --------------------------------------------------
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

-- ---- seed default Indian categories ---------------------------------------
create or replace function public.seed_default_categories(_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (family_id, name, kind, icon, color, is_default)
  values
    (_family_id, 'Salary',             'income',  'wallet',         '#22c55e', true),
    (_family_id, 'Business',           'income',  'briefcase',      '#16a34a', true),
    (_family_id, 'Freelance',          'income',  'laptop',         '#4ade80', true),
    (_family_id, 'Interest',           'income',  'piggy-bank',     '#10b981', true),
    (_family_id, 'Rental Income',      'income',  'home',           '#34d399', true),
    (_family_id, 'Gifts',              'income',  'gift',           '#a3e635', true),
    (_family_id, 'Refunds',            'income',  'rotate-ccw',     '#84cc16', true),
    (_family_id, 'Other Income',       'income',  'circle-plus',    '#65a30d', true),
    (_family_id, 'Groceries',          'expense', 'shopping-cart',  '#ef4444', true),
    (_family_id, 'Rent',               'expense', 'home',           '#f97316', true),
    (_family_id, 'Utilities',          'expense', 'plug',           '#f59e0b', true),
    (_family_id, 'Mobile & Internet',  'expense', 'smartphone',     '#eab308', true),
    (_family_id, 'Transport & Fuel',   'expense', 'fuel',           '#f43f5e', true),
    (_family_id, 'Dining Out',         'expense', 'utensils',       '#ec4899', true),
    (_family_id, 'Shopping',           'expense', 'shopping-bag',   '#d946ef', true),
    (_family_id, 'Health & Medical',   'expense', 'heart-pulse',    '#a855f7', true),
    (_family_id, 'Education',          'expense', 'graduation-cap', '#8b5cf6', true),
    (_family_id, 'Entertainment',      'expense', 'clapperboard',   '#6366f1', true),
    (_family_id, 'EMI & Loans',        'expense', 'landmark',       '#3b82f6', true),
    (_family_id, 'Insurance',          'expense', 'shield-check',   '#0ea5e9', true),
    (_family_id, 'Domestic Help',      'expense', 'brush',          '#06b6d4', true),
    (_family_id, 'Travel',             'expense', 'plane',          '#14b8a6', true),
    (_family_id, 'Personal Care',      'expense', 'scissors',       '#f472b6', true),
    (_family_id, 'Kids',               'expense', 'baby',           '#fb923c', true),
    (_family_id, 'Charity & Donations','expense', 'hand-heart',     '#94a3b8', true),
    (_family_id, 'Taxes',              'expense', 'receipt',        '#64748b', true),
    (_family_id, 'Other Expense',      'expense', 'circle-minus',   '#6b7280', true)
  on conflict do nothing;
end;
$$;

-- ---- family creation -------------------------------------------------------
create or replace function public.handle_new_family()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.family_members (family_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (family_id, user_id) do update
    set role = 'owner',
        deleted_at = null,
        updated_at = now();

  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

-- ---- validate transaction/recurring references ----------------------------
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
      where a.id = new.account_id
        and a.family_id = new.family_id
        and a.deleted_at is null
    ) then
      raise exception 'account % does not belong to family %', new.account_id, new.family_id;
    end if;

    if not exists (
      select 1 from public.categories c
      where c.id = new.category_id
        and c.family_id = new.family_id
        and c.kind = new.type
        and c.deleted_at is null
    ) then
      raise exception 'category % is not a valid % category for family %',
        new.category_id, new.type, new.family_id;
    end if;

  elsif new.type = 'transfer' then
    if not exists (
      select 1 from public.accounts a
      where a.id = new.from_account_id
        and a.family_id = new.family_id
        and a.deleted_at is null
    ) then
      raise exception 'from_account % does not belong to family %', new.from_account_id, new.family_id;
    end if;

    if not exists (
      select 1 from public.accounts a
      where a.id = new.to_account_id
        and a.family_id = new.family_id
        and a.deleted_at is null
    ) then
      raise exception 'to_account % does not belong to family %', new.to_account_id, new.family_id;
    end if;
  end if;

  return new;
end;
$$;

-- ---- validate budgets ------------------------------------------------------
create or replace function public.validate_budget()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.period_month := date_trunc('month', new.period_month)::date;

  if not exists (
    select 1 from public.categories c
    where c.id = new.category_id
      and c.family_id = new.family_id
      and c.kind = 'expense'
      and c.deleted_at is null
  ) then
    raise exception 'budget category % must be an expense category in family %',
      new.category_id, new.family_id;
  end if;

  return new;
end;
$$;

-- ---- family invite RPCs ----------------------------------------------------
create or replace function public.create_family_invite(
  _family_id  uuid,
  _expires_at timestamptz default null,
  _max_uses   integer default null
)
returns public.family_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  _code text;
  _row  public.family_invites;
begin
  if not public.can_edit_family(_family_id) then
    raise exception 'Not authorized to create invites for this family';
  end if;

  loop
    _code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
    exit when not exists (
      select 1 from public.family_invites where code = _code
    );
  end loop;

  insert into public.family_invites
    (family_id, code, created_by, expires_at, max_uses)
  values
    (_family_id, _code, auth.uid(), _expires_at, _max_uses)
  returning * into _row;

  return _row;
end;
$$;

create or replace function public.join_family_with_code(_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _invite public.family_invites;
  _uid    uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into _invite
  from public.family_invites
  where upper(code) = upper(trim(_code))
    and deleted_at is null
    and is_active
    and (expires_at is null or expires_at > now())
    and (max_uses is null or used_count < max_uses)
  limit 1;

  if _invite.id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  if exists (
    select 1 from public.family_members
    where family_id = _invite.family_id
      and user_id = _uid
      and deleted_at is null
  ) then
    return _invite.family_id;
  end if;

  if exists (
    select 1 from public.family_members
    where family_id = _invite.family_id
      and user_id = _uid
      and deleted_at is not null
  ) then
    update public.family_members
       set role = 'member',
           deleted_at = null,
           updated_at = now()
     where family_id = _invite.family_id
       and user_id = _uid;
  else
    insert into public.family_members (family_id, user_id, role)
    values (_invite.family_id, _uid, 'member');
  end if;

  update public.family_invites
     set used_count = used_count + 1,
         updated_at = now()
   where id = _invite.id;

  return _invite.family_id;
end;
$$;

grant execute on function public.create_family_invite(uuid, timestamptz, integer) to authenticated;
grant execute on function public.join_family_with_code(text) to authenticated;
revoke execute on function public.create_family_invite(uuid, timestamptz, integer) from anon;
revoke execute on function public.join_family_with_code(text) from anon;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

drop trigger if exists trg_auth_user_profile_created on auth.users;
create trigger trg_auth_user_profile_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user_profile();

drop trigger if exists trg_family_after_insert on public.families;
create trigger trg_family_after_insert
  after insert on public.families
  for each row execute function public.handle_new_family();

drop trigger if exists trg_txn_validate on public.transactions;
create trigger trg_txn_validate
  before insert or update on public.transactions
  for each row execute function public.validate_txn_references();

drop trigger if exists trg_recurring_validate on public.recurring_transactions;
create trigger trg_recurring_validate
  before insert or update on public.recurring_transactions
  for each row execute function public.validate_txn_references();

drop trigger if exists trg_budget_validate on public.budgets;
create trigger trg_budget_validate
  before insert or update on public.budgets
  for each row execute function public.validate_budget();

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'families', 'family_members', 'accounts', 'categories',
    'transactions', 'budgets', 'recurring_transactions', 'family_invites'
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
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles               enable row level security;
alter table public.families               enable row level security;
alter table public.family_members         enable row level security;
alter table public.accounts               enable row level security;
alter table public.categories             enable row level security;
alter table public.transactions           enable row level security;
alter table public.budgets                enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.family_invites         enable row level security;

-- ---- profiles --------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_select_shared_family on public.profiles;
create policy profiles_select_shared_family on public.profiles
  for select using (
    exists (
      select 1
      from public.family_members viewer_membership
      join public.family_members profile_membership
        on profile_membership.family_id = viewer_membership.family_id
      where viewer_membership.user_id = auth.uid()
        and viewer_membership.deleted_at is null
        and profile_membership.user_id = profiles.id
        and profile_membership.deleted_at is null
    )
  );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
             with check (id = auth.uid());

grant select, update on public.profiles to authenticated;
revoke all on public.profiles from anon;

-- ---- families --------------------------------------------------------------
drop policy if exists families_select on public.families;
create policy families_select on public.families
  for select using (public.is_family_member(id));

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
drop policy if exists family_members_select on public.family_members;
create policy family_members_select on public.family_members
  for select using (public.is_family_member(family_id));

drop policy if exists family_members_insert on public.family_members;
create policy family_members_insert on public.family_members
  for insert with check (
    public.is_family_owner(family_id) or user_id = auth.uid()
  );

drop policy if exists family_members_update on public.family_members;
create policy family_members_update on public.family_members
  for update using (public.is_family_owner(family_id) or user_id = auth.uid())
              with check (public.is_family_owner(family_id) or user_id = auth.uid());

drop policy if exists family_members_delete on public.family_members;
create policy family_members_delete on public.family_members
  for delete using (public.is_family_owner(family_id) or user_id = auth.uid());

-- ---- accounts --------------------------------------------------------------
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

-- ---- categories ------------------------------------------------------------
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

-- ---- transactions ----------------------------------------------------------
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

-- ---- budgets ---------------------------------------------------------------
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

-- ---- recurring_transactions ------------------------------------------------
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

-- ---- family_invites --------------------------------------------------------
drop policy if exists family_invites_select on public.family_invites;
create policy family_invites_select on public.family_invites
  for select using (public.is_family_member(family_id));

drop policy if exists family_invites_insert on public.family_invites;
create policy family_invites_insert on public.family_invites
  for insert with check (public.can_edit_family(family_id));

drop policy if exists family_invites_update on public.family_invites;
create policy family_invites_update on public.family_invites
  for update using (public.can_edit_family(family_id))
              with check (public.can_edit_family(family_id));

drop policy if exists family_invites_delete on public.family_invites;
create policy family_invites_delete on public.family_invites
  for delete using (public.can_edit_family(family_id));

-- =============================================================================
-- VIEWS
-- =============================================================================

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
    as current_balance
from public.accounts a
where a.deleted_at is null;

-- =============================================================================
-- END CONSOLIDATED SCHEMA
-- =============================================================================
