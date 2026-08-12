-- =============================================================================
-- Personal Finance Tracker - Migration 16: gold receipt (bill) storage
-- =============================================================================
-- Optional bill/receipt attached to a gold purchase. The file lives in a
-- PRIVATE Supabase Storage bucket ('receipts'); gold_holdings just stores the
-- object path. Path convention: '{family_id}/gold/{uuid}.{ext}', so the first
-- folder segment is the owning family — Storage RLS reuses the same
-- is_family_member / can_edit_family helpers as the tables.
-- =============================================================================

-- 1. Path reference on the holding (nullable — receipts are optional).
alter table public.gold_holdings
  add column if not exists receipt_path text;

-- 2. Private bucket (10 MB cap; images + PDF only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3. Storage RLS — family-scoped by the first path segment.
drop policy if exists receipts_select on storage.objects;
create policy receipts_select on storage.objects
  for select using (
    bucket_id = 'receipts'
    and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists receipts_insert on storage.objects;
create policy receipts_insert on storage.objects
  for insert with check (
    bucket_id = 'receipts'
    and public.can_edit_family(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists receipts_update on storage.objects;
create policy receipts_update on storage.objects
  for update using (
    bucket_id = 'receipts'
    and public.can_edit_family(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'receipts'
    and public.can_edit_family(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects
  for delete using (
    bucket_id = 'receipts'
    and public.can_edit_family(((storage.foldername(name))[1])::uuid)
  );

-- =============================================================================
-- End migration 16.
-- =============================================================================
