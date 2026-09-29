-- 1) Pay model per campaign: per 1,000 views (as before) or a fixed amount per video.
--    fixed_cents set = each approved video that reaches min_views earns exactly that amount.
-- 2) Only admins change pay terms (rate, minimum, fixed amount, budget) after a campaign exists.
-- 3) Content has a language, so creators can post in their own language.

alter table public.campaigns add column fixed_cents integer check (fixed_cents between 1 and 1000000);

create function public.video_pay_cents(p_views integer, p_min_views integer, p_cpm_cents integer, p_fixed_cents integer)
returns integer
language sql immutable set search_path = public
as $$
  select case
    when p_views < p_min_views then 0
    when p_fixed_cents is not null then p_fixed_cents
    else (p_views::bigint * p_cpm_cents / 1000)::integer
  end
$$;

create or replace view internal.video_money as
select s.id as submission_id, s.creator_id, s.campaign_id, s.status, s.views, s.created_at,
       (s.status = 'approved' and s.views >= r.min_views) as qualifies,
       case when s.status = 'approved' then public.video_pay_cents(s.views, r.min_views, r.cpm_cents, c.fixed_cents) else 0 end as earned_cents
from public.submissions s
join public.campaigns c on c.id = s.campaign_id
cross join lateral public.effective_rate(s.creator_id, s.campaign_id) r;

create or replace view public.submission_earnings with (security_invoker = true) as
select s.id as submission_id, s.creator_id, s.campaign_id, s.status, s.views,
       r.min_views, r.cpm_cents,
       (s.status = 'approved' and s.views >= r.min_views) as qualifies,
       case when s.status = 'approved' then public.video_pay_cents(s.views, r.min_views, r.cpm_cents, c.fixed_cents) else 0 end as earned_cents,
       s.created_at
from public.submissions s
join public.campaigns c on c.id = s.campaign_id
cross join lateral public.effective_rate(s.creator_id, s.campaign_id) r;

create or replace function public.weekly_earnings(p_weeks integer default 12)
returns table (week_start date, creator_id uuid, name text, video_cents bigint, videos_counted integer)
language sql stable security definer set search_path = public
as $$
  with weeks as (
    select (date_trunc('week', now()) - make_interval(weeks => g))::date as week_start
    from generate_series(0, greatest(1, least(p_weeks, 104)) - 1) g
  ),
  vids as (
    select s.id, s.creator_id, r.cpm_cents, r.min_views, c.fixed_cents
    from submissions s join campaigns c on c.id = s.campaign_id
    cross join lateral effective_rate(s.creator_id, s.campaign_id) r
    where s.status = 'approved' and (s.creator_id = auth.uid() or is_admin())
  ),
  per_video as (
    select w.week_start, v.creator_id,
           video_pay_cents(coalesce(e.views, 0), v.min_views, v.cpm_cents, v.fixed_cents)
         - video_pay_cents(coalesce(b.views, 0), v.min_views, v.cpm_cents, v.fixed_cents) as cents
    from weeks w cross join vids v
    left join lateral (select views from view_snapshots where submission_id = v.id and taken_at < w.week_start order by taken_at desc limit 1) b on true
    left join lateral (select views from view_snapshots where submission_id = v.id and taken_at < w.week_start + 7 order by taken_at desc limit 1) e on true
  )
  select pv.week_start, pv.creator_id, p.name, sum(pv.cents)::bigint, count(*) filter (where pv.cents <> 0)::integer
  from per_video pv join profiles p on p.id = pv.creator_id
  group by pv.week_start, pv.creator_id, p.name
  having sum(pv.cents) <> 0
  order by pv.week_start desc, sum(pv.cents) desc
$$;

create or replace function public.leaderboard(p_month date default null, p_limit integer default 10)
returns table (rank integer, creator_id uuid, first_name text, views_gained bigint, earned_cents bigint, is_me boolean)
language sql stable security definer set search_path = public
as $$
  with m as (
    select date_trunc('month', coalesce(p_month, now()::date))::date as s,
           (date_trunc('month', coalesce(p_month, now()::date)) + interval '1 month')::date as e
  ),
  allowed as (select is_admin() or (select visible from leaderboard_settings) as ok),
  per_video as (
    select s.creator_id,
           coalesce(e.views, 0) - coalesce(b.views, 0) as gained,
           video_pay_cents(coalesce(e.views, 0), r.min_views, r.cpm_cents, c.fixed_cents)
         - video_pay_cents(coalesce(b.views, 0), r.min_views, r.cpm_cents, c.fixed_cents) as cents
    from submissions s join campaigns c on c.id = s.campaign_id cross join m
    cross join lateral effective_rate(s.creator_id, s.campaign_id) r
    left join lateral (select views from view_snapshots where submission_id = s.id and taken_at < m.s order by taken_at desc limit 1) b on true
    left join lateral (select views from view_snapshots where submission_id = s.id and taken_at < m.e order by taken_at desc limit 1) e on true
    where s.status = 'approved'
  ),
  totals as (
    select creator_id, sum(gained)::bigint as gained, sum(cents)::bigint as cents from per_video group by creator_id having sum(gained) > 0
  ),
  ranked as (
    select (row_number() over (order by t.gained desc, p.created_at))::integer as rank, t.creator_id,
           split_part(coalesce(nullif(p.name, ''), 'Creator'), ' ', 1) as first_name, t.gained, t.cents
    from totals t join profiles p on p.id = t.creator_id
    where p.role = 'creator'
  )
  select r.rank,
         case when is_admin() or r.creator_id = auth.uid() then r.creator_id end,
         r.first_name, r.gained,
         case when is_admin() then r.cents end,
         r.creator_id = auth.uid()
  from ranked r, allowed a
  where a.ok and (r.rank <= greatest(1, least(p_limit, 100)) or r.creator_id = auth.uid())
  order by r.rank
$$;

-- Pay terms: only admins change them once a campaign exists.
create function public.guard_campaign() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or is_admin() then return new; end if;
  if (new.cpm_cents, new.min_views, new.fixed_cents, new.budget_cents, new.brand_id)
     is distinct from (old.cpm_cents, old.min_views, old.fixed_cents, old.budget_cents, old.brand_id) then
    raise exception 'Only the Hypiva team can change the pay or budget of a campaign';
  end if;
  return new;
end $$;
create trigger guard_campaign before update on public.campaigns
  for each row execute function public.guard_campaign();
revoke execute on function public.guard_campaign() from authenticated, anon, public;

-- Content languages (two-letter codes: en, nl, de, es, fr, ...).
alter table public.content_packs add column language text not null default 'en' check (language ~ '^[a-z]{2}$');

drop function public.next_content(uuid, uuid);
create function public.next_content(p_campaign uuid, p_account uuid, p_language text default null) returns uuid
language plpgsql stable security definer set search_path = public
as $$
declare v uuid;
begin
  if not exists (select 1 from campaign_members where campaign_id = p_campaign and creator_id = auth.uid()) then
    raise exception 'Join this campaign first';
  end if;
  if not exists (select 1 from tiktok_accounts where id = p_account and creator_id = auth.uid()) then
    raise exception 'Use one of your own linked TikTok accounts';
  end if;
  select p.id into v
  from content_packs p
  where p.campaign_id = p_campaign and p.active
    and (p_language is null or p.language = p_language)
    and not exists (select 1 from submissions s where s.content_pack_id = p.id and s.tiktok_account_id = p_account)
  order by (select count(*) from submissions s where s.content_pack_id = p.id), p.created_at
  limit 1;
  return v;
end $$;
revoke all on function public.next_content(uuid, uuid, text) from public, anon;
grant execute on function public.next_content(uuid, uuid, text) to authenticated;
