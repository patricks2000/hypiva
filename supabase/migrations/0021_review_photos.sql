-- Reviews can have a photo of the client (or their logo).
-- Visitors upload it to the public "review-photos" bucket before sending the review;
-- the review only shows (with its photo) after an admin approves it.

alter table public.reviews add column if not exists photo_url text;

-- Only photos from our own bucket, so a review can't point to an outside image.
alter table public.reviews drop constraint if exists reviews_photo_url_check;
alter table public.reviews add constraint reviews_photo_url_check check (
  photo_url is null
  or photo_url like 'https://fooxcixwmmdjursbsols.supabase.co/storage/v1/object/public/review-photos/%'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "review photo upload by anyone" on storage.objects;
create policy "review photo upload by anyone" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'review-photos' and name ~ '^[0-9a-f-]{36}\.jpg$');

drop policy if exists "review photo delete by admins" on storage.objects;
create policy "review photo delete by admins" on storage.objects
  for delete to authenticated
  using (bucket_id = 'review-photos' and is_admin());
