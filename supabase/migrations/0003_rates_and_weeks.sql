-- 1) Custom pay rates per creator (all campaigns, or one campaign).
-- 2) View history, so money can be split per week.

------------------------------------------------------------------------------
-- Custom rates
------------------------------------------------------------------------------
create table public.creator_rates (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid not null references public.profiles (id) on delete cascade,
  campaign_id  uuid references public.campaigns (id) on delete cascade,   -- null = every campaign
  cpm_cents    integer not null check (cpm_cents between 0 and 100000),
  min_views    integer check (min_views >= 0),                            -- null = the campaign's minimum
  note         text check (length(note) <= 200),
  created_at   timestamptz not null default now()
);
create unique index creator_rates_one_per_scope
  on public.creator_rates (creator_id, coalesce(campaign_id, '00000000-0000-0000-0000-000000000000'));

-- The rate that applies: a rate for this campaign beats a rate for all campaigns beats the campaign default.
create function public.effective_rate(p_creator uuid, p_campaign uuid, out cpm_cents integer, out min_views integer)
language sql stable security definer set search_path = public
as $$
  select coalesce(r.cpm_cents, c.cpm_cents), coalesce(r.min_views, c.min_views)
  from campaigns c
  left join lateral (
    select cr.cpm_cents, cr.min_views from creator_rates cr
    where cr.creator_id = p_creator and (cr.campaign_id = c.id or cr.campaign_id is null)
    order by cr.campaign_id nulls last limit 1
  ) r on true
  where c.id = p_campaign
$$;

------------------------------------------------------------------------------
-- View history: every change to a video's views is remembered
------------------------------------------------------------------------------
create table public.view_snapshots (
  id             bigint generated always as identity primary key,
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  views          integer not null check (views >= 0),
  taken_at       timestamptz not null default now()
);
create index view_snapshots_lookup on public.view_snapshots (submission_id, taken_at desc);

create function public.record_views() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.views is distinct from old.views then
    insert into view_snapshots (submission_id, views) values (new.id, new.views);
  end if;
  return new;
end $$;
create trigger record_views after insert or update of views on public.submissions
  for each row execute function public.record_views();

insert into public.view_snapshots (submission_id, views, taken_at)
select id, views, coalesce(views_updated_at, created_at) from public.submissions;

------------------------------------------------------------------------------
-- Money maths now uses the effective rate
------------------------------------------------------------------------------
create or replace view internal.video_money as
select s.id as submission_id, s.creator_id, s.campaign_id, s.status, s.views, s.created_at,
       (s.status = 'approved' and s.views >= r.min_views) as qualifies,
       case when s.status = 'approved' then public.video_earnings_cents(s.views, r.min_views, r.cpm_cents) else 0 end as earned_cents
from public.submissions s
cross join lateral public.effective_rate(s.creator_id, s.campaign_id) r;

create or replace view public.submission_earnings with (security_invoker = true) as
select s.id as submission_id, s.creator_id, s.campaign_id, s.status, s.views,
       r.min_views, r.cpm_cents,
       (s.status = 'approved' and s.views >= r.min_views) as qualifies,
       case when s.status = 'approved' then public.video_earnings_cents(s.views, r.min_views, r.cpm_cents) else 0 end as earned_cents,
       s.created_at
from public.submissions s
cross join lateral public.effective_rate(s.creator_id, s.campaign_id) r;

-- campaign_stats read submission_earnings; it picks up the new rates automatically.

------------------------------------------------------------------------------
-- Money per week (Monday to Sunday)
------------------------------------------------------------------------------
-- What each creator earned in each week: earnings at the end of the week minus at the start,
-- using the view count known at each moment. Only approved videos count; current rates apply.
create function public.weekly_earnings(p_weeks integer default 12)
returns table (week_start date, creator_id uuid, name text, video_cents bigint, videos_counted integer)
language sql stable security definer set search_path = public
as $$
  with weeks as (
    select (date_trunc('week', now()) - make_interval(weeks => g))::date as week_start
    from generate_series(0, greatest(1, least(p_weeks, 104)) - 1) g
  ),
  vids as (
    select s.id, s.creator_id, r.cpm_cents, r.min_views
    from submissions s cross join lateral effective_rate(s.creator_id, s.campaign_id) r
    where s.status = 'approved' and (s.creator_id = auth.uid() or is_admin())
  ),
  per_video as (
    select w.week_start, v.creator_id,
           video_earnings_cents(coalesce(e.views, 0), v.min_views, v.cpm_cents)
         - video_earnings_cents(coalesce(b.views, 0), v.min_views, v.cpm_cents) as cents,
           coalesce(e.views, 0) > coalesce(b.views, 0) as grew
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
revoke all on function public.weekly_earnings(integer) from public, anon;
grant execute on function public.weekly_earnings(integer) to authenticated;

------------------------------------------------------------------------------
-- Access
------------------------------------------------------------------------------
alter table public.creator_rates enable row level security;
alter table public.view_snapshots enable row level security;

-- Creators may see their own special rates; only admins set them.
create policy creator_rates_read on public.creator_rates for select to authenticated
  using (creator_id = auth.uid() or is_admin());
create policy creator_rates_admin on public.creator_rates for all to authenticated
  using (is_admin()) with check (is_admin());

create policy view_snapshots_read on public.view_snapshots for select to authenticated
  using (is_admin() or exists (select 1 from submissions s where s.id = submission_id and s.creator_id = auth.uid()));

grant select, insert, update, delete on public.creator_rates to authenticated;
grant select on public.view_snapshots to authenticated;
revoke all on public.creator_rates, public.view_snapshots from anon;
