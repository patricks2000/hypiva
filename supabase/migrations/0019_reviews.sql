-- Client reviews for the homepage. Anyone can send one from hypiva.com/write-review (it starts hidden);
-- an admin approves it in the app, and only approved reviews are shown on the site.
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 80),
  company     text not null default '' check (length(company) <= 100),
  role        text not null default '' check (length(role) <= 80),
  body        text not null check (length(trim(body)) between 10 and 600),
  rating      smallint not null check (rating between 1 and 5),
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.reviews enable row level security;
-- Visitors may send a review, but it always starts hidden.
create policy reviews_public_insert on public.reviews for insert to anon, authenticated with check (approved = false);
-- Visitors only see approved reviews; admins see everything.
create policy reviews_public_read on public.reviews for select to anon, authenticated using (approved or is_admin());
create policy reviews_admin_update on public.reviews for update to authenticated using (is_admin()) with check (is_admin());
create policy reviews_admin_delete on public.reviews for delete to authenticated using (is_admin());
grant select, insert on public.reviews to anon;
grant select, insert, update, delete on public.reviews to authenticated;
