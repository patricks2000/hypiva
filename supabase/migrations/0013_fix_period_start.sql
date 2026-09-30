-- Fix: in weekly totals and the leaderboard, a video with no view count from before the period
-- was treated as "already earning" when the minimum is 0 (fixed pay per video), so it showed $0.
-- No earlier count now means it had earned nothing yet.

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
         - case when b.views is null then 0 else video_pay_cents(b.views, v.min_views, v.cpm_cents, v.fixed_cents) end as cents
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
         - case when b.views is null then 0 else video_pay_cents(b.views, r.min_views, r.cpm_cents, c.fixed_cents) end as cents
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
