-- Visitors (anon) can't run is_admin(), so give them their own read policy: approved reviews only.
drop policy reviews_public_read on public.reviews;
create policy reviews_anon_read on public.reviews for select to anon using (approved);
create policy reviews_user_read on public.reviews for select to authenticated using (approved or is_admin());
