-- Invite program: every creator gets a code. When someone signs up with it, the inviter earns
-- a share of that creator's approved video earnings for a while, up to a maximum per invited creator.
-- The bonus is paid on top; the invited creator never loses anything.

------------------------------------------------------------------------------
-- Settings (one row, owner can change them in the app)
------------------------------------------------------------------------------
create table public.referral_settings (
  id              boolean primary key default true check (id),
  percent_bp      integer not null default 500 check (percent_bp between 0 and 5000),   -- 500 = 5%
  months          integer not null default 6 check (months between 1 and 36),
  cap_cents       integer not null default 10000 check (cap_cents >= 0),               -- $100 per invited creator
  signup_window_days integer not null default 14 check (signup_window_days between 0 and 365)
);
insert into public.referral_settings default values;

------------------------------------------------------------------------------
-- Codes and who invited whom
------------------------------------------------------------------------------
alter table public.profiles add column referral_code text unique;

create function public.new_referral_code() returns text
language plpgsql volatile set search_path = public
as $$
declare v text; alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  loop
    v := 'HY';
    for i in 1..6 loop v := v || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from profiles where referral_code = v);
  end loop;
  return v;
end $$;

update public.profiles set referral_code = public.new_referral_code() where referral_code is null;
alter table public.profiles alter column referral_code set not null;

create table public.referrals (
  referred_id  uuid primary key references public.profiles (id) on delete cascade,  -- invited once, ever
  referrer_id  uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  check (referred_id <> referrer_id)
);
create index referrals_referrer_idx on public.referrals (referrer_id);

-- Nobody edits their own code; everything else about the guard stays the same.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if; -- server/service key
  if new.referral_code is distinct from old.referral_code then
    raise exception 'Invite codes cannot be changed';
  end if;
  if (new.role, new.is_owner, new.brand_id) is distinct from (old.role, old.is_owner, old.brand_id) then
    if not is_owner() then raise exception 'Only the owner can change roles'; end if;
    if old.id = auth.uid() or new.is_owner is distinct from old.is_owner then
      raise exception 'Owner status and your own role can only be changed in the database';
    end if;
  end if;
  return new;
end $$;

-- Link a new creator to an inviter. Used at sign-up and from the app.
create function public.link_referral(p_user uuid, p_code text) returns void
language plpgsql security definer set search_path = public
as $$
declare v_referrer uuid; v_window integer; v_created timestamptz;
begin
  select id into v_referrer from profiles where referral_code = upper(trim(p_code)) and role = 'creator';
  if v_referrer is null then raise exception 'This invite code does not exist'; end if;
  if v_referrer = p_user then raise exception 'You cannot use your own code'; end if;
  if exists (select 1 from referrals where referred_id = p_user) then raise exception 'You already used an invite code'; end if;
  if exists (select 1 from referrals where referred_id = v_referrer and referrer_id = p_user) then
    raise exception 'You cannot use the code of someone you invited';
  end if;
  select signup_window_days into v_window from referral_settings;
  select created_at into v_created from profiles where id = p_user;
  if v_created < now() - make_interval(days => v_window) then
    raise exception 'Invite codes can only be added in the first % days after signing up', v_window;
  end if;
  insert into referrals (referred_id, referrer_id) values (p_user, v_referrer);
end $$;
revoke all on function public.link_referral(uuid, text) from public, anon, authenticated;

-- App: "I have an invite code".
create function public.use_referral_code(p_code text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if my_role() is distinct from 'creator' then raise exception 'Only creators can use invite codes'; end if;
  perform link_referral(auth.uid(), p_code);
end $$;
revoke all on function public.use_referral_code(text) from public, anon;
grant execute on function public.use_referral_code(text) to authenticated;

-- New sign-ups get a code, and are linked when they signed up with someone's code.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles (id, name, referral_code)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new_referral_code());
  if coalesce(new.raw_user_meta_data ->> 'referral_code', '') <> '' then
    begin
      perform link_referral(new.id, new.raw_user_meta_data ->> 'referral_code');
    exception when others then
      null; -- a wrong code never blocks signing up
    end;
  end if;
  return new;
end $$;

------------------------------------------------------------------------------
-- The maths
------------------------------------------------------------------------------
-- Add the post date so bonuses only count videos from the bonus period.
create or replace view public.submission_earnings with (security_invoker = true) as
select s.id as submission_id, s.creator_id, s.campaign_id, s.status, s.views,
       c.min_views, c.cpm_cents,
       (s.status = 'approved' and s.views >= c.min_views) as qualifies,
       case when s.status = 'approved' then public.video_earnings_cents(s.views, c.min_views, c.cpm_cents) else 0 end as earned_cents,
       s.created_at
from public.submissions s
join public.campaigns c on c.id = s.campaign_id;

-- Private copy of the per-video maths for the views below. They run with owner rights and filter
-- rows themselves; a security_invoker view inside them would apply the caller's row rules again.
-- Kept in a schema the API does not expose.
create schema if not exists internal;
revoke all on schema internal from public;
create view internal.video_money as
select s.id as submission_id, s.creator_id, s.campaign_id, s.status, s.views, s.created_at,
       (s.status = 'approved' and s.views >= c.min_views) as qualifies,
       case when s.status = 'approved' then public.video_earnings_cents(s.views, c.min_views, c.cpm_cents) else 0 end as earned_cents
from public.submissions s
join public.campaigns c on c.id = s.campaign_id;

-- One row per invite: what the inviter has earned from that person so far.
-- Runs with owner rights so the inviter's total can count the invited person's videos,
-- but only ever returns rows about the person asking (or everything for admins).
create view public.referral_bonuses as
select r.referrer_id, r.referred_id, r.created_at,
       r.created_at + make_interval(months => rs.months) as ends_at,
       coalesce(sum(e.earned_cents), 0)::bigint as invited_earned_cents,
       least(floor(coalesce(sum(e.earned_cents), 0) * rs.percent_bp / 10000.0), rs.cap_cents)::bigint as bonus_cents,
       (floor(coalesce(sum(e.earned_cents), 0) * rs.percent_bp / 10000.0) >= rs.cap_cents) as capped
from public.referrals r
cross join public.referral_settings rs
left join internal.video_money e
  on e.creator_id = r.referred_id
 and e.status = 'approved'
 and e.created_at >= r.created_at
 and e.created_at < r.created_at + make_interval(months => rs.months)
where r.referrer_id = auth.uid() or r.referred_id = auth.uid() or public.is_admin()
group by r.referrer_id, r.referred_id, r.created_at, rs.months, rs.percent_bp, rs.cap_cents;

-- Balances now include invite bonuses. Same explicit filter: yourself, or everyone for admins.
drop view public.creator_balances;
create view public.creator_balances as
with videos as (
  select e.creator_id,
         count(*)::integer                                          as videos,
         count(*) filter (where e.qualifies)::integer               as paid_videos,
         coalesce(sum(e.views) filter (where e.status <> 'rejected'), 0)::bigint as views,
         coalesce(sum(e.earned_cents), 0)::bigint                   as video_cents
  from internal.video_money e group by e.creator_id
), bonus as (
  select referrer_id as creator_id, count(*)::integer as invites, coalesce(sum(bonus_cents), 0)::bigint as bonus_cents
  from public.referral_bonuses group by referrer_id
), pay as (
  select creator_id,
         coalesce(sum(amount_cents) filter (where status = 'paid'), 0)::bigint      as paid_cents,
         coalesce(sum(amount_cents) filter (where status = 'requested'), 0)::bigint as requested_cents
  from public.payouts group by creator_id
)
select p.id as creator_id, p.name, p.handle,
       coalesce(v.videos, 0)       as videos,
       coalesce(v.paid_videos, 0)  as paid_videos,
       coalesce(v.views, 0)        as views,
       coalesce(v.video_cents, 0)  as video_earned_cents,
       coalesce(b.invites, 0)      as invites,
       coalesce(b.bonus_cents, 0)  as referral_earned_cents,
       (coalesce(v.video_cents, 0) + coalesce(b.bonus_cents, 0))::bigint as earned_cents,
       coalesce(pay.paid_cents, 0)      as paid_cents,
       coalesce(pay.requested_cents, 0) as requested_cents,
       greatest(coalesce(v.video_cents, 0) + coalesce(b.bonus_cents, 0) - coalesce(pay.paid_cents, 0), 0)::bigint as owed_cents,
       greatest(coalesce(v.video_cents, 0) + coalesce(b.bonus_cents, 0) - coalesce(pay.paid_cents, 0) - coalesce(pay.requested_cents, 0), 0)::bigint as available_cents
from public.profiles p
left join videos v on v.creator_id = p.id
left join bonus b on b.creator_id = p.id
left join pay on pay.creator_id = p.id
where p.role = 'creator' and (p.id = auth.uid() or public.is_admin());

-- The inviter's list: first name only, when they joined, what they brought in.
create function public.my_referrals()
returns table (referred_id uuid, first_name text, joined_at timestamptz, ends_at timestamptz, bonus_cents bigint, capped boolean)
language sql stable security definer set search_path = public
as $$
  select b.referred_id, split_part(coalesce(nullif(p.name, ''), 'Creator'), ' ', 1), b.created_at, b.ends_at, b.bonus_cents, b.capped
  from referral_bonuses b join profiles p on p.id = b.referred_id
  where b.referrer_id = auth.uid()
  order by b.created_at desc
$$;
revoke all on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated;

------------------------------------------------------------------------------
-- Access
------------------------------------------------------------------------------
alter table public.referral_settings enable row level security;
alter table public.referrals enable row level security;

create policy referral_settings_read on public.referral_settings for select to authenticated using (true);
create policy referral_settings_owner on public.referral_settings for update to authenticated
  using (is_owner()) with check (is_owner());

-- You see the invite that brought you in, the ones you made, or all of them as admin. Writes go through use_referral_code.
create policy referrals_read on public.referrals for select to authenticated
  using (referred_id = auth.uid() or referrer_id = auth.uid() or is_admin());
create policy referrals_admin_delete on public.referrals for delete to authenticated using (is_owner());

grant select on public.referral_settings, public.referrals, public.referral_bonuses, public.creator_balances, public.submission_earnings to authenticated;
revoke all on public.referral_bonuses, public.creator_balances from anon;
grant update on public.referral_settings to authenticated;
grant delete on public.referrals to authenticated;
