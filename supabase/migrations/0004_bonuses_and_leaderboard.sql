-- Manual bonuses (e.g. "Top creator of September: $50") and a monthly leaderboard.

------------------------------------------------------------------------------
-- Manual bonuses
------------------------------------------------------------------------------
create table public.bonuses (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references public.profiles (id) on delete cascade,
  -- Negative amounts are allowed to correct a mistake.
  amount_cents  integer not null check (amount_cents <> 0 and amount_cents between -1000000 and 1000000),
  reason        text not null check (length(trim(reason)) between 1 and 120),
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index bonuses_creator_idx on public.bonuses (creator_id);

create function public.stamp_bonus() returns trigger
language plpgsql security definer set search_path = public
as $$ begin new.created_by := auth.uid(); new.created_at := now(); return new; end $$;
create trigger stamp_bonus before insert on public.bonuses for each row execute function public.stamp_bonus();

alter table public.bonuses enable row level security;
create policy bonuses_read on public.bonuses for select to authenticated using (creator_id = auth.uid() or is_admin());
create policy bonuses_admin on public.bonuses for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, delete on public.bonuses to authenticated;
revoke all on public.bonuses from anon;

-- Balances include manual bonuses (new column at the end; earned/owed/available now count them).
create or replace view public.creator_balances as
with videos as (
  select e.creator_id,
         count(*)::integer                                          as videos,
         count(*) filter (where e.qualifies)::integer               as paid_videos,
         coalesce(sum(e.views) filter (where e.status <> 'rejected'), 0)::bigint as views,
         coalesce(sum(e.earned_cents), 0)::bigint                   as video_cents
  from internal.video_money e group by e.creator_id
), invite as (
  select referrer_id as creator_id, count(*)::integer as invites, coalesce(sum(bonus_cents), 0)::bigint as bonus_cents
  from public.referral_bonuses group by referrer_id
), manual as (
  select creator_id, coalesce(sum(amount_cents), 0)::bigint as cents from public.bonuses group by creator_id
), pay as (
  select creator_id,
         coalesce(sum(amount_cents) filter (where status = 'paid'), 0)::bigint      as paid_cents,
         coalesce(sum(amount_cents) filter (where status = 'requested'), 0)::bigint as requested_cents
  from public.payouts group by creator_id
), t as (
  select p.id, p.name, p.handle,
         coalesce(v.videos, 0) as videos, coalesce(v.paid_videos, 0) as paid_videos, coalesce(v.views, 0) as views,
         coalesce(v.video_cents, 0) as video_cents, coalesce(i.invites, 0) as invites, coalesce(i.bonus_cents, 0) as invite_cents,
         coalesce(m.cents, 0) as manual_cents,
         coalesce(pay.paid_cents, 0) as paid_cents, coalesce(pay.requested_cents, 0) as requested_cents
  from public.profiles p
  left join videos v on v.creator_id = p.id
  left join invite i on i.creator_id = p.id
  left join manual m on m.creator_id = p.id
  left join pay on pay.creator_id = p.id
  where p.role = 'creator' and (p.id = auth.uid() or public.is_admin())
)
select id as creator_id, name, handle, videos, paid_videos, views,
       video_cents  as video_earned_cents,
       invites,
       invite_cents as referral_earned_cents,
       (video_cents + invite_cents + manual_cents)::bigint as earned_cents,
       paid_cents, requested_cents,
       greatest(video_cents + invite_cents + manual_cents - paid_cents, 0)::bigint as owed_cents,
       greatest(video_cents + invite_cents + manual_cents - paid_cents - requested_cents, 0)::bigint as available_cents,
       manual_cents::bigint as bonus_cents
from t;

------------------------------------------------------------------------------
-- Leaderboard
------------------------------------------------------------------------------
create table public.leaderboard_settings (
  id          boolean primary key default true check (id),
  visible     boolean not null default false,   -- creators only see it once the owner turns it on
  prize_text  text not null default '' check (length(prize_text) <= 120)
);
insert into public.leaderboard_settings default values;
alter table public.leaderboard_settings enable row level security;
create policy leaderboard_settings_read on public.leaderboard_settings for select to authenticated using (true);
create policy leaderboard_settings_owner on public.leaderboard_settings for update to authenticated using (is_owner()) with check (is_owner());
grant select, update on public.leaderboard_settings to authenticated;

-- Views gained on approved videos during a month (from the view history), per creator.
-- Creators see first names and views only; admins also see what each person earned that month.
create function public.leaderboard(p_month date default null, p_limit integer default 10)
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
           video_earnings_cents(coalesce(e.views, 0), r.min_views, r.cpm_cents)
         - video_earnings_cents(coalesce(b.views, 0), r.min_views, r.cpm_cents) as cents
    from submissions s cross join m
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
revoke all on function public.leaderboard(date, integer) from public, anon;
grant execute on function public.leaderboard(date, integer) to authenticated;
