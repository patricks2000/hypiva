-- Clients (brands) pay Hypiva a budget; what creators are paid from it stays internal.
-- campaign_stats still gives brands their views and videos, but "spent" only to admins.
create or replace view public.campaign_stats with (security_invoker = true) as
select c.id as campaign_id,
       count(e.submission_id)::integer                                         as videos,
       coalesce(sum(e.views) filter (where e.status <> 'rejected'), 0)::bigint as views,
       case when public.is_admin() then coalesce(sum(e.earned_cents), 0)::bigint end as spent_cents
from public.campaigns c
left join public.submission_earnings e on e.campaign_id = c.id
group by c.id;
