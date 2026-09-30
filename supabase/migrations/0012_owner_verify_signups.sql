-- 1) The owner account is set up automatically: the first confirmed sign-up with the owner email
--    becomes admin + owner. Only when there is no owner yet, so it can never be taken over later.
-- 2) Campaigns a brand creates start paused; an admin checks the pay terms and makes them live.
-- 3) TikTok account verification: the creator puts a code in their TikTok bio, a server check marks
--    the account verified. Reviewers see which accounts are verified.
-- 4) New sign-ups: the owner gets a notification (edge function "notify-signup", when an email key is set).

create table internal.settings (
  id           boolean primary key default true check (id),
  owner_email  text not null
);
insert into internal.settings (owner_email) values ('patrickkruiger@icloud.com');

create function public.claim_owner() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.email_confirmed_at is not null
     and lower(new.email) = (select lower(owner_email) from internal.settings)
     and not exists (select 1 from profiles where is_owner) then
    update profiles set role = 'admin', is_owner = true where id = new.id;
  end if;
  return new;
end $$;
revoke execute on function public.claim_owner() from authenticated, anon, public;
-- "zz_" so it runs after on_auth_user_created (triggers fire in name order) and the profile exists.
create trigger zz_claim_owner_on_confirm after insert or update of email_confirmed_at on auth.users
  for each row execute function public.claim_owner();

-- Brand-made campaigns wait for the Hypiva team.
create function public.guard_new_campaign() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not is_admin() then new.status := 'paused'; end if;
  return new;
end $$;
revoke execute on function public.guard_new_campaign() from authenticated, anon, public;
create trigger guard_new_campaign before insert on public.campaigns
  for each row execute function public.guard_new_campaign();

-- Brands may pause their campaign, but only admins make it live.
create or replace function public.guard_campaign() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or is_admin() then return new; end if;
  if (new.cpm_cents, new.min_views, new.fixed_cents, new.budget_cents, new.brand_id)
     is distinct from (old.cpm_cents, old.min_views, old.fixed_cents, old.budget_cents, old.brand_id) then
    raise exception 'Only the Hypiva team can change the pay or budget of a campaign';
  end if;
  if new.status = 'live' and old.status <> 'live' then
    raise exception 'The Hypiva team makes campaigns live after checking them';
  end if;
  return new;
end $$;

-- Account verification codes.
create function public.new_verify_code() returns text
language sql volatile set search_path = public
as $$ select 'HY-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)) $$;
revoke execute on function public.new_verify_code() from anon, public;
grant execute on function public.new_verify_code() to authenticated; -- used as the default when a creator links an account

alter table public.tiktok_accounts
  add column verify_code text not null default public.new_verify_code(),
  add column verified_at timestamptz;

-- Creators cannot set verified themselves (they have no update rights; insert forces false).
-- The server marks an account verified after it found the code in the TikTok bio.
create function public.mark_account_verified(p_account uuid) returns void
language sql security definer set search_path = public
as $$ update tiktok_accounts set verified = true, verified_at = now() where id = p_account $$;
revoke all on function public.mark_account_verified(uuid) from public, anon, authenticated;

-- Sign-up notification (Supabase only): call the edge function with the refresh secret.
create function public.notify_signup() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net')
     and exists (select 1 from information_schema.schemata where schema_name = 'vault') then
    begin
      execute $q$select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/notify-signup',
        headers := jsonb_build_object('Content-Type', 'application/json',
          'x-refresh-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'refresh_views_secret')),
        body := jsonb_build_object('id', $1))$q$ using new.id;
    exception when others then
      null; -- a failed notification never blocks signing up
    end;
  end if;
  return new;
end $$;
revoke execute on function public.notify_signup() from authenticated, anon, public;
create trigger notify_signup after insert on public.profiles
  for each row execute function public.notify_signup();
