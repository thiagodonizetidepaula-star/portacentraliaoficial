insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prospect-site-images', 'prospect-site-images', true, 2500000, array['image/webp', 'image/jpeg']);

-- The public object endpoint serves images by URL. Listings and changes to
-- existing objects need their own policies, so operators can only upload.
create policy "Prospect operators can upload generated site images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'prospect-site-images'
    and (select auth.jwt() -> 'app_metadata' -> 'prospect_operator') = 'true'::jsonb
    and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
    and name ~ (
      '^' || (select auth.uid())::text || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](webp|jpe?g)$'
    )
  );
