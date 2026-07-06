-- =============================================================================
-- Personal Finance Tracker — Migration 02: Family Invites & Onboarding RPCs
-- =============================================================================
-- Run this AFTER supabase/schema.sql, in the Supabase SQL Editor.
--
-- Why RPCs? Under RLS a user who is NOT yet a member cannot see a family or its
-- invites, so they can't look up which family a code belongs to. The join is
-- therefore done inside a SECURITY DEFINER function that validates the code and
-- inserts the membership server-side. Code generation is likewise done in a
-- definer function so codes stay unique and members never craft their own.
-- =============================================================================

-- ---- family_invites --------------------------------------------------------
create table if not exists public.family_invites (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  code        text not null unique,
  created_by  uuid references auth.users (id) on delete set null,
  expires_at  timestamptz,          -- null = never expires
  max_uses    integer,              -- null = unlimited
  used_count  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists idx_family_invites_family
  on public.family_invites (family_id) where deleted_at is null;
create index if not exists idx_family_invites_code
  on public.family_invites (code) where deleted_at is null;

-- updated_at trigger (set_updated_at defined in schema.sql)
drop trigger if exists trg_set_updated_at on public.family_invites;
create trigger trg_set_updated_at
  before update on public.family_invites
  for each row execute function public.set_updated_at();

-- ---- RLS -------------------------------------------------------------------
alter table public.family_invites enable row level security;

-- Members can view their family's invites.
drop policy if exists family_invites_select on public.family_invites;
create policy family_invites_select on public.family_invites
  for select using (public.is_family_member(family_id));

-- Owners/members can create, update (revoke) and delete invites.
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

-- ---- RPC: create_family_invite ---------------------------------------------
-- Generates a unique 8-char code and returns the new invite row.
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

  -- Generate a unique, human-friendly uppercase code.
  -- Uses gen_random_uuid(), which is available via pgcrypto in schema.sql.
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

-- ---- RPC: join_family_with_code --------------------------------------------
-- Validates a code and adds the current user as a 'member'. Returns family_id.
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

  -- Idempotent: if already an active member, just return the family.
  if exists (
    select 1 from public.family_members
    where family_id = _invite.family_id
      and user_id = _uid
      and deleted_at is null
  ) then
    return _invite.family_id;
  end if;

  -- If the user previously left this family, reactivate the soft-deleted
  -- membership row instead of inserting a duplicate (the table has a unique
  -- constraint on family_id + user_id).
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

-- Only authenticated users should call these.
grant execute on function public.create_family_invite(uuid, timestamptz, integer) to authenticated;
grant execute on function public.join_family_with_code(text) to authenticated;
revoke execute on function public.create_family_invite(uuid, timestamptz, integer) from anon;
revoke execute on function public.join_family_with_code(text) from anon;

-- =============================================================================
-- End of migration 02.
-- =============================================================================
