-- =============================================================================
-- Personal Finance Tracker - Migration 05: Transaction Creator Profile FK
-- =============================================================================
-- Adds a direct relationship from transactions.created_by to profiles.id so
-- Supabase/PostgREST can embed creator profile data in transaction queries.
-- The existing auth.users FK remains the source of auth integrity.
-- =============================================================================

alter table public.transactions
  drop constraint if exists transactions_created_by_profiles_fkey;

alter table public.transactions
  add constraint transactions_created_by_profiles_fkey
  foreign key (created_by)
  references public.profiles (id)
  on delete set null;

-- =============================================================================
-- End migration 05.
-- =============================================================================
