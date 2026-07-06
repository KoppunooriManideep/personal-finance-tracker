-- =============================================================================
-- Personal Finance Tracker - Migration 07: Fix Rejoining a Family
-- =============================================================================
-- Leaving a family soft-deletes the family_members row. Because the table has a
-- unique constraint on (family_id, user_id), rejoining with an invite code must
-- reactivate the old row instead of inserting a duplicate.
-- =============================================================================

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

  -- Already active: no-op.
  if exists (
    select 1 from public.family_members
    where family_id = _invite.family_id
      and user_id = _uid
      and deleted_at is null
  ) then
    return _invite.family_id;
  end if;

  -- Previously left/removed: reactivate the soft-deleted membership.
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

grant execute on function public.join_family_with_code(text) to authenticated;
revoke execute on function public.join_family_with_code(text) from anon;

-- =============================================================================
-- End migration 07.
-- =============================================================================
