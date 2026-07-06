-- =============================================================================
-- Personal Finance Tracker - Migration 06: Family Member Profile FK
-- =============================================================================
-- Adds a direct relationship from family_members.user_id to profiles.id so
-- Supabase/PostgREST can embed profile data in family member queries.
-- =============================================================================

alter table public.family_members
  drop constraint if exists family_members_user_id_profiles_fkey;

alter table public.family_members
  add constraint family_members_user_id_profiles_fkey
  foreign key (user_id)
  references public.profiles (id)
  on delete cascade;

-- =============================================================================
-- End migration 06.
-- =============================================================================
