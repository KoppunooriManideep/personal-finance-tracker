-- =============================================================================
-- Personal Finance Tracker - Migration 03: Fix Invite Code Generation
-- =============================================================================
-- Some Supabase projects do not expose gen_random_bytes(integer) on the
-- function search path used by create_family_invite. Replace invite generation
-- with gen_random_uuid(), which the base schema already requires.
-- =============================================================================

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

grant execute on function public.create_family_invite(uuid, timestamptz, integer) to authenticated;
revoke execute on function public.create_family_invite(uuid, timestamptz, integer) from anon;

-- =============================================================================
-- End migration 03.
-- =============================================================================
