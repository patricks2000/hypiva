-- Privacy hardening.
-- 1) Payout details (IBAN / PayPal) move out of profiles into their own table.
--    Brands may read the names of creators who post for them, but never how those creators get paid.
-- 2) Uploaded content images: images only, max 10 MB each.

create table public.payout_accounts (
  creator_id  uuid primary key references public.profiles (id) on delete cascade,
  method      text not null check (method in ('paypal', 'bank')),
  details     text not null check (length(trim(details)) between 3 and 200),
  updated_at  timestamptz not null default now()
);

insert into public.payout_accounts (creator_id, method, details)
select id, payout_method, payout_details from public.profiles
where payout_method is not null and payout_details is not null and length(trim(payout_details)) >= 3;

alter table public.profiles drop column payout_method, drop column payout_details;

create function public.stamp_payout_account() returns trigger
language plpgsql set search_path = public as $$ begin new.updated_at := now(); return new; end $$;
create trigger stamp_payout_account before insert or update on public.payout_accounts
  for each row execute function public.stamp_payout_account();

alter table public.payout_accounts enable row level security;
-- The creator manages their own details; admins may read them to send money. Nobody else sees them.
create policy payout_accounts_read on public.payout_accounts for select to authenticated
  using (creator_id = auth.uid() or is_admin());
create policy payout_accounts_insert on public.payout_accounts for insert to authenticated
  with check (creator_id = auth.uid());
create policy payout_accounts_update on public.payout_accounts for update to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy payout_accounts_delete on public.payout_accounts for delete to authenticated
  using (creator_id = auth.uid());
grant select, insert, update, delete on public.payout_accounts to authenticated;
revoke all on public.payout_accounts from anon;

-- Content uploads: images only, 10 MB each (Supabase only).
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    update storage.buckets
       set file_size_limit = 10485760,
           allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
     where id = 'content';
  end if;
end $$;

-- 3) Signed-out visitors get no access to any table, view or function. Everything needs a login.
--    (Supabase grants these to "anon" by default; row rules already hid the data, this removes the door as well.)
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
