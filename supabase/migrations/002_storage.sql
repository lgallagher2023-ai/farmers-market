-- ============================================================
-- Storage bucket for vendor assets (logos, banners)
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Create the bucket (idempotent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-assets',
  'vendor-assets',
  true,
  5242880,   -- 5 MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- ── RLS policies on storage.objects ──────────────────────────────────────

-- Anyone can view files in vendor-assets (it's a public bucket)
drop policy if exists "Public read vendor assets" on storage.objects;
create policy "Public read vendor assets"
  on storage.objects for select
  using (bucket_id = 'vendor-assets');

-- Vendors can upload their own logos (path must start with logos/{their_vendor_id}/)
-- We cross-reference vendor_profiles to ensure the vendor_id in the path belongs to them.
drop policy if exists "Vendors can upload own logo" on storage.objects;
create policy "Vendors can upload own logo"
  on storage.objects for insert
  with check (
    bucket_id = 'vendor-assets'
    and exists (
      select 1 from vendor_profiles
      where user_id = auth.uid()
        and (storage.foldername(name))[1] = 'logos'
        and (storage.foldername(name))[2] = id::text
    )
  );

-- Vendors can update/replace their own files
drop policy if exists "Vendors can update own logo" on storage.objects;
create policy "Vendors can update own logo"
  on storage.objects for update
  using (
    bucket_id = 'vendor-assets'
    and exists (
      select 1 from vendor_profiles
      where user_id = auth.uid()
        and (storage.foldername(name))[2] = id::text
    )
  );

-- Vendors can delete their own files
drop policy if exists "Vendors can delete own logo" on storage.objects;
create policy "Vendors can delete own logo"
  on storage.objects for delete
  using (
    bucket_id = 'vendor-assets'
    and exists (
      select 1 from vendor_profiles
      where user_id = auth.uid()
        and (storage.foldername(name))[2] = id::text
    )
  );
