-- Free sample requests: a brand uploads 1–5 screenshots of their app on the homepage,
-- then the "brand-lead" edge function saves the request with links to those screenshots.
-- Files get a random UUID name, so nobody can guess or overwrite another brand's upload.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sample-shots', 'sample-shots', true, 4194304, array['image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = 4194304, allowed_mime_types = array['image/jpeg'];

drop policy if exists "sample shot upload by anyone" on storage.objects;
create policy "sample shot upload by anyone" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'sample-shots' and name ~ '^[0-9a-f-]{36}\.jpg$');

drop policy if exists "sample shot delete by admins" on storage.objects;
create policy "sample shot delete by admins" on storage.objects
  for delete to authenticated
  using (bucket_id = 'sample-shots' and is_admin());
