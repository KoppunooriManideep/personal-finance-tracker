-- =============================================================================
-- Personal Finance Tracker - Migration 04: Profiles
-- =============================================================================
-- Creates public profiles synced from auth.users Google metadata so user ids
-- such as transactions.created_by can be joined to a display name/avatar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Profiles table
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
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

-- -----------------------------------------------------------------------------
-- 2. updated_at trigger for profiles
-- -----------------------------------------------------------------------------
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_profiles_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Sync profile when a new auth user signs up
-- -----------------------------------------------------------------------------
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

drop trigger if exists trg_auth_user_profile_created on auth.users;
create trigger trg_auth_user_profile_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user_profile();

-- -----------------------------------------------------------------------------
-- 4. One-time backfill for existing auth users
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 5. RLS policies
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Users can view their own profile.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

-- Users can view profiles of people who share at least one active family.
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

-- Users can update only their own profile.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
             with check (id = auth.uid());

-- Authenticated clients may read/update profiles; RLS controls row access.
grant select, update on public.profiles to authenticated;
revoke all on public.profiles from anon;

-- Add a direct relationship from family_members.user_id to profiles.id so
-- Supabase/PostgREST can embed member profile data.
alter table public.family_members
  drop constraint if exists family_members_user_id_profiles_fkey;

alter table public.family_members
  add constraint family_members_user_id_profiles_fkey
  foreign key (user_id)
  references public.profiles (id)
  on delete cascade;

-- =============================================================================
-- End migration 04.
-- =============================================================================
