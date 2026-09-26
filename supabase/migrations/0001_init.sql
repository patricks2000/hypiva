-- Viewtra database: accounts, roles, campaigns, videos, earnings and payouts.
-- Money is stored in cents (integers) so totals never drift.
-- Every table has row level security: people only get the rows they are allowed to see.

create extension if not exists pgcrypto;

------------------------------------------------------------------------------
-- Types
------------------------------------------------------------------------------
create type public.app_role as enum ('creator', 'brand', 'admin');
create type public.campaign_kind as enum ('ready_to_post', 'create_your_own');
create type public.campaign_status as enum ('live', 'paused', 'ended');
create type public.submission_status as enum ('pending', 'approved', 'rejected');
create type public.payout_status as enum ('requested', 'paid', 'cancelled');

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------
create table public.brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 80),
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  name            text not null default '' check (length(name) <= 80),
  handle          text unique check (handle ~ '^[a-z0-9._]{2,30}$'),
  role            public.app_role not null default 'creator',
  -- The owner is the only person who can hand out or take away roles.
  is_owner        boolean not null default false,
  -- Set for brand users: the brand whose campaigns they manage.
  brand_id        uuid references public.brands (id) on delete set null,
  payout_method   text check (payout_method in ('paypal', 'bank')),
  payout_details  text check (length(payout_details) <= 200),
  created_at      timestamptz not null default now()
);

create table public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.brands (id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 80),
  description   text not null default '' check (length(description) <= 2000),
  kind          public.campaign_kind not null default 'ready_to_post',
  -- Pay per 1,000 views, in cents. $2.00 = 200.
  cpm_cents     integer not null check (cpm_cents between 1 and 100000),
  -- A video only earns once it reaches this many views on its own.
  min_views     integer not null default 1000 check (min_views >= 0),
  budget_cents  integer not null check (budget_cents > 0),
  status        public.campaign_status not null default 'live',
  created_at    timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  creator_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (campaign_id, creator_id)
);

create table public.tiktok_accounts (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.profiles (id) on delete cascade,
  username    text not null unique check (username ~ '^[A-Za-z0-9._]{2,24}$'),
  verified    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.submissions (
  id                 uuid primary key default gen_random_uuid(),
  campaign_id        uuid not null references public.campaigns (id) on delete restrict,
  creator_id         uuid not null references public.profiles (id) on delete cascade,
  tiktok_account_id  uuid not null references public.tiktok_accounts (id),
  url                text not null unique check (url ~* '^https://(www\.|vm\.|m\.)?tiktok\.com/'),
  status             public.submission_status not null default 'pending',
  views              integer not null default 0 check (views >= 0),
  views_updated_at   timestamptz,
  reviewed_by        uuid references public.profiles (id) on delete set null,
  reviewed_at        timestamptz,
  reject_reason      text check (length(reject_reason) <= 300),
  created_at         timestamptz not null default now()
);
create index submissions_creator_idx on public.submissions (creator_id);
create index submissions_campaign_idx on public.submissions (campaign_id);

create table public.payouts (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references public.profiles (id) on delete cascade,
  amount_cents  integer not null check (amount_cents > 0),
  status        public.payout_status not null default 'requested',
  requested_at  timestamptz not null default now(),
  paid_at       timestamptz,
  paid_by       uuid references public.profiles (id) on delete set null,
  note          text check (length(note) <= 300)
);
create index payouts_creator_idx on public.payouts (creator_id);
-- One open request per creator at a time.
create unique index payouts_one_open_request on public.payouts (creator_id) where status = 'requested';

------------------------------------------------------------------------------
-- Earnings rule
------------------------------------------------------------------------------
-- Views are counted per video and never added up across videos.
-- Below the minimum a video earns nothing; from the minimum on, every view counts.
-- Example at $2 per 1K and a 1,000 minimum: 999 views = $0, 1,000 = $2.00, 1,500 = $3.00.
create function public.video_earnings_cents(p_views integer, p_min_views integer, p_cpm_cents integer)
returns integer
language sql immutable
as $$
  select case when p_views >= p_min_views then (p_views::bigint * p_cpm_cents / 1000)::integer else 0 end
$$;

------------------------------------------------------------------------------
-- Who is asking
------------------------------------------------------------------------------
create function public.my_role() returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select role = 'admin' from profiles where id = auth.uid()), false) $$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select is_owner from profiles where id = auth.uid()), false) $$;

create function public.my_brand() returns uuid
language sql stable security definer set search_path = public
as $$ select brand_id from profiles where id = auth.uid() and role = 'brand' $$;

create function public.brand_owns_campaign(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from campaigns where id = p_campaign and brand_id = my_brand()) $$;

------------------------------------------------------------------------------
-- New sign-ups become creators
------------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------------------------
-- Guards: stop people changing fields that are not theirs to change
------------------------------------------------------------------------------
-- Only the owner changes roles, owner status or brand links (via set_user_role).
create function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if; -- server/service key
  if (new.role, new.is_owner, new.brand_id) is distinct from (old.role, old.is_owner, old.brand_id) then
    if not is_owner() then raise exception 'Only the owner can change roles'; end if;
    if old.id = auth.uid() or new.is_owner is distinct from old.is_owner then
      raise exception 'Owner status and your own role can only be changed in the database';
    end if;
  end if;
  return new;
end $$;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- Creators never edit a video after sending it. Brands only review.
-- View counts are only changed by admins (or the server when TikTok is connected).
create function public.guard_submission() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or is_admin() then
    if new.views is distinct from old.views then new.views_updated_at := now(); end if;
    if new.status is distinct from old.status and new.status <> 'pending' then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    end if;
    return new;
  end if;
  if brand_owns_campaign(old.campaign_id) then
    if (new.campaign_id, new.creator_id, new.tiktok_account_id, new.url, new.views, new.views_updated_at, new.created_at)
       is distinct from (old.campaign_id, old.creator_id, old.tiktok_account_id, old.url, old.views, old.views_updated_at, old.created_at) then
      raise exception 'Brands can only approve or reject videos';
    end if;
    new.reviewed_by := auth.uid(); new.reviewed_at := now();
    return new;
  end if;
  raise exception 'Not allowed';
end $$;
create trigger guard_submission before update on public.submissions
  for each row execute function public.guard_submission();

-- New videos always start pending with 0 views, and must use the creator's own account on a joined campaign.
create function public.guard_new_submission() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or is_admin() then return new; end if;
  if new.creator_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if not exists (select 1 from tiktok_accounts where id = new.tiktok_account_id and creator_id = auth.uid()) then
    raise exception 'Use one of your own linked TikTok accounts';
  end if;
  if not exists (select 1 from campaign_members m join campaigns c on c.id = m.campaign_id
                 where m.campaign_id = new.campaign_id and m.creator_id = auth.uid() and c.status = 'live') then
    raise exception 'Join this campaign first';
  end if;
  new.status := 'pending'; new.views := 0; new.views_updated_at := null;
  new.reviewed_by := null; new.reviewed_at := null; new.reject_reason := null; new.created_at := now();
  return new;
end $$;
create trigger guard_new_submission before insert on public.submissions
  for each row execute function public.guard_new_submission();

------------------------------------------------------------------------------
-- Views that do the maths (they respect the row rules of whoever asks)
------------------------------------------------------------------------------
create view public.submission_earnings with (security_invoker = true) as
select s.id as submission_id, s.creator_id, s.campaign_id, s.status, s.views,
       c.min_views, c.cpm_cents,
       (s.status = 'approved' and s.views >= c.min_views) as qualifies,
       case when s.status = 'approved' then public.video_earnings_cents(s.views, c.min_views, c.cpm_cents) else 0 end as earned_cents
from public.submissions s
join public.campaigns c on c.id = s.campaign_id;

create view public.creator_balances with (security_invoker = true) as
select p.id as creator_id, p.name, p.handle,
       count(e.submission_id)::integer                                             as videos,
       count(e.submission_id) filter (where e.qualifies)::integer                  as paid_videos,
       coalesce(sum(e.views) filter (where e.status <> 'rejected'), 0)::bigint     as views,
       coalesce(sum(e.earned_cents), 0)::bigint                                    as earned_cents,
       coalesce(pp.paid_cents, 0)::bigint                                          as paid_cents,
       coalesce(pp.requested_cents, 0)::bigint                                     as requested_cents,
       greatest(coalesce(sum(e.earned_cents), 0) - coalesce(pp.paid_cents, 0), 0)::bigint as owed_cents,
       greatest(coalesce(sum(e.earned_cents), 0) - coalesce(pp.paid_cents, 0) - coalesce(pp.requested_cents, 0), 0)::bigint as available_cents
from public.profiles p
left join public.submission_earnings e on e.creator_id = p.id
left join lateral (
  select sum(amount_cents) filter (where status = 'paid')      as paid_cents,
         sum(amount_cents) filter (where status = 'requested') as requested_cents
  from public.payouts where creator_id = p.id
) pp on true
where p.role = 'creator' and (p.id = auth.uid() or public.is_admin())
group by p.id, p.name, p.handle, pp.paid_cents, pp.requested_cents;

create view public.campaign_stats with (security_invoker = true) as
select c.id as campaign_id,
       count(e.submission_id)::integer                                         as videos,
       coalesce(sum(e.views) filter (where e.status <> 'rejected'), 0)::bigint as views,
       coalesce(sum(e.earned_cents), 0)::bigint                                as spent_cents
from public.campaigns c
left join public.submission_earnings e on e.campaign_id = c.id
group by c.id;

------------------------------------------------------------------------------
-- Actions
------------------------------------------------------------------------------
-- Owner only: give someone a role. Brand users need a brand.
create function public.set_user_role(p_user uuid, p_role public.app_role, p_brand uuid default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_owner() then raise exception 'Only the owner can change roles'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own role'; end if;
  if p_role = 'brand' and p_brand is null then raise exception 'Pick a brand for this user'; end if;
  update profiles set role = p_role, brand_id = case when p_role = 'brand' then p_brand end where id = p_user;
end $$;

-- Creator: ask to be paid what is available. Minimum $10.
create function public.request_payout() returns public.payouts
language plpgsql security definer set search_path = public
as $$
declare v_available bigint; v_row payouts;
begin
  if my_role() is distinct from 'creator' then raise exception 'Only creators can request payouts'; end if;
  select available_cents into v_available from creator_balances where creator_id = auth.uid();
  if coalesce(v_available, 0) < 1000 then raise exception 'You need at least $10 to request a payout'; end if;
  insert into payouts (creator_id, amount_cents) values (auth.uid(), v_available) returning * into v_row;
  return v_row;
end $$;

-- Admin: record that everything owed to a creator has been sent.
create function public.mark_creator_paid(p_creator uuid, p_note text default null) returns bigint
language plpgsql security definer set search_path = public
as $$
declare v_owed bigint; v_requested bigint;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select owed_cents, requested_cents into v_owed, v_requested from creator_balances where creator_id = p_creator;
  if coalesce(v_owed, 0) <= 0 then raise exception 'Nothing is owed to this creator'; end if;
  update payouts set status = 'paid', paid_at = now(), paid_by = auth.uid(), note = coalesce(p_note, note)
   where creator_id = p_creator and status = 'requested';
  if v_owed - coalesce(v_requested, 0) > 0 then
    insert into payouts (creator_id, amount_cents, status, paid_at, paid_by, note)
    values (p_creator, v_owed - coalesce(v_requested, 0), 'paid', now(), auth.uid(), p_note);
  end if;
  return v_owed;
end $$;

-- Anyone: delete their own account (Apple requires this in the app).
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  if is_owner() then raise exception 'The owner account cannot be deleted from the app'; end if;
  delete from auth.users where id = auth.uid();
end $$;

------------------------------------------------------------------------------
-- Row level security
------------------------------------------------------------------------------
alter table public.brands            enable row level security;
alter table public.profiles          enable row level security;
alter table public.campaigns         enable row level security;
alter table public.campaign_members  enable row level security;
alter table public.tiktok_accounts   enable row level security;
alter table public.submissions       enable row level security;
alter table public.payouts           enable row level security;

-- brands
create policy brands_read on public.brands for select to authenticated
  using (is_admin() or id = my_brand() or exists (select 1 from campaigns c where c.brand_id = brands.id and c.status = 'live'));
create policy brands_admin on public.brands for all to authenticated using (is_admin()) with check (is_admin());

-- profiles: yourself, admins see everyone, brands see creators who posted for them
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or is_admin()
         or exists (select 1 from submissions s join campaigns c on c.id = s.campaign_id
                    where s.creator_id = profiles.id and c.brand_id = my_brand()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or is_owner()) with check (id = auth.uid() or is_owner());

-- campaigns: live ones are public to signed-in users; brands manage their own; admins everything
create policy campaigns_read on public.campaigns for select to authenticated
  using (status = 'live' or is_admin() or brand_id = my_brand()
         or exists (select 1 from campaign_members m where m.campaign_id = campaigns.id and m.creator_id = auth.uid()));
create policy campaigns_write on public.campaigns for insert to authenticated
  with check (is_admin() or brand_id = my_brand());
create policy campaigns_update on public.campaigns for update to authenticated
  using (is_admin() or brand_id = my_brand()) with check (is_admin() or brand_id = my_brand());
create policy campaigns_delete on public.campaigns for delete to authenticated using (is_admin());

-- campaign members
create policy members_read on public.campaign_members for select to authenticated
  using (creator_id = auth.uid() or is_admin() or brand_owns_campaign(campaign_id));
create policy members_join on public.campaign_members for insert to authenticated
  with check (creator_id = auth.uid() and my_role() = 'creator'
              and exists (select 1 from campaigns c where c.id = campaign_id and c.status = 'live'));
create policy members_leave on public.campaign_members for delete to authenticated
  using (creator_id = auth.uid() or is_admin());

-- tiktok accounts
create policy accounts_read on public.tiktok_accounts for select to authenticated
  using (creator_id = auth.uid() or is_admin()
         or exists (select 1 from submissions s where s.tiktok_account_id = tiktok_accounts.id and brand_owns_campaign(s.campaign_id)));
create policy accounts_add on public.tiktok_accounts for insert to authenticated
  with check (creator_id = auth.uid() and verified = false);
create policy accounts_remove on public.tiktok_accounts for delete to authenticated
  using (creator_id = auth.uid() or is_admin());
create policy accounts_admin on public.tiktok_accounts for update to authenticated
  using (is_admin()) with check (is_admin());

-- submissions
create policy submissions_read on public.submissions for select to authenticated
  using (creator_id = auth.uid() or is_admin() or brand_owns_campaign(campaign_id));
create policy submissions_add on public.submissions for insert to authenticated
  with check (creator_id = auth.uid() or is_admin());
create policy submissions_update on public.submissions for update to authenticated
  using (is_admin() or brand_owns_campaign(campaign_id)) with check (is_admin() or brand_owns_campaign(campaign_id));
create policy submissions_delete on public.submissions for delete to authenticated using (is_admin());

-- payouts: creators see their own; only admins change them (requests go through request_payout)
create policy payouts_read on public.payouts for select to authenticated
  using (creator_id = auth.uid() or is_admin());
create policy payouts_admin on public.payouts for all to authenticated
  using (is_admin()) with check (is_admin());

-- Nobody but these functions and admins writes directly.
revoke all on function public.set_user_role(uuid, public.app_role, uuid) from public, anon;
revoke all on function public.request_payout() from public, anon;
revoke all on function public.mark_creator_paid(uuid, text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role, uuid) to authenticated;
grant execute on function public.request_payout() to authenticated;
grant execute on function public.mark_creator_paid(uuid, text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
