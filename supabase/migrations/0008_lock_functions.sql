-- Tighten function access after 0007 (which re-granted every function to signed-in users).
-- 1) link_referral is internal: only sign-up and use_referral_code may call it.
-- 2) Trigger functions are never called directly.
-- 3) effective_rate only reveals a special rate to that creator, admins, or the brand that owns the campaign.
-- 4) video_earnings_cents gets a fixed search_path.

revoke execute on function public.link_referral(uuid, text) from authenticated, anon, public;
revoke execute on function public.handle_new_user() from authenticated, anon, public;
revoke execute on function public.guard_profile() from authenticated, anon, public;
revoke execute on function public.guard_submission() from authenticated, anon, public;
revoke execute on function public.guard_new_submission() from authenticated, anon, public;
revoke execute on function public.record_views() from authenticated, anon, public;
revoke execute on function public.stamp_bonus() from authenticated, anon, public;
revoke execute on function public.stamp_payout_account() from authenticated, anon, public;
revoke execute on function public.new_referral_code() from authenticated, anon, public;

create or replace function public.effective_rate(p_creator uuid, p_campaign uuid, out cpm_cents integer, out min_views integer)
language sql stable security definer set search_path = public
as $$
  select coalesce(r.cpm_cents, c.cpm_cents), coalesce(r.min_views, c.min_views)
  from campaigns c
  left join lateral (
    select cr.cpm_cents, cr.min_views from creator_rates cr
    where cr.creator_id = p_creator and (cr.campaign_id = c.id or cr.campaign_id is null)
      and (p_creator = auth.uid() or auth.uid() is null or is_admin() or brand_owns_campaign(c.id))
    order by cr.campaign_id nulls last limit 1
  ) r on true
  where c.id = p_campaign
$$;

alter function public.video_earnings_cents(integer, integer, integer) set search_path = public;
