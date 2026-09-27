-- Custom rates and weekly totals. Runs after the other tests.
\set ON_ERROR_STOP 1
set client_min_messages = notice;
\pset tuples_only on
\o /dev/null
reset role;
create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false); end $$;
create function pg_temp.check(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok  %', what; end $$;
select pg_temp.as_user(null);

-- Rosa: one approved video with 5,000 views on the $2 campaign
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000e1', 'rosa@example.com', '{"name":"Rosa Rate"}');
insert into campaign_members values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', now());
insert into tiktok_accounts (id, creator_id, username) values ('30000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1', 'rosa.fit');
insert into submissions (id, campaign_id, creator_id, tiktok_account_id, url, status, views) values
 ('40000000-0000-0000-0000-0000000000e1', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', '30000000-0000-0000-0000-0000000000e1', 'https://www.tiktok.com/@rosa/video/1', 'approved', 5000);

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((select earned_cents = 1000 from creator_balances), 'Rosa: 5,000 views at the campaign rate of $2 = $10.00');
do $$ begin insert into creator_rates (creator_id, cpm_cents) values ('00000000-0000-0000-0000-0000000000e1', 9999); exception when others then null; end $$;
select pg_temp.check((select count(*) = 0 from creator_rates), 'a creator cannot give themself a better rate');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into creator_rates (creator_id, cpm_cents, note) values ('00000000-0000-0000-0000-0000000000e1', 100, 'starter rate');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((select earned_cents = 500 from creator_balances), 'the owner sets Rosa to $1 per 1K: now $5.00');
select pg_temp.check((select cpm_cents = 100 from submission_earnings), 'Rosa sees her own rate of $1');
select pg_temp.check((select count(*) = 1 from creator_rates), 'Rosa can see her special rate');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into creator_rates (creator_id, campaign_id, cpm_cents, min_views) values ('00000000-0000-0000-0000-0000000000e1', '20000000-0000-0000-0000-000000000001', 300, 6000);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((select earned_cents = 0 from creator_balances), 'a rate for one campaign wins: $3 but minimum 6,000, so 5,000 views earn $0');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
delete from creator_rates where campaign_id is not null and creator_id = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.check((select earned_cents = 500 from creator_balances where creator_id = '00000000-0000-0000-0000-0000000000e1'), 'removing it goes back to the $1 rate');
select pg_temp.check((select earned_cents = 1400 from creator_balances where name = 'Alex'), 'other creators keep the campaign rate');

-- Weeks: Rosa's video had 800 views two weeks ago, 3,000 last week, 5,000 now
reset role;
select pg_temp.as_user(null);
delete from view_snapshots where submission_id = '40000000-0000-0000-0000-0000000000e1';
insert into view_snapshots (submission_id, views, taken_at) values
 ('40000000-0000-0000-0000-0000000000e1', 800,  date_trunc('week', now()) - interval '10 days'),
 ('40000000-0000-0000-0000-0000000000e1', 3000, date_trunc('week', now()) - interval '3 days'),
 ('40000000-0000-0000-0000-0000000000e1', 5000, now());
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select video_cents = 300 from weekly_earnings(4) where name = 'Rosa Rate' and week_start = (date_trunc('week', now()) - interval '7 days')::date),
  'last week: 800 -> 3,000 views at $1 = $0 -> $3.00, so $3.00 that week');
select pg_temp.check((select video_cents = 200 from weekly_earnings(4) where name = 'Rosa Rate' and week_start = date_trunc('week', now())::date),
  'this week: 3,000 -> 5,000 views = $2.00 more');
select pg_temp.check((select coalesce(sum(video_cents), 0) = 0 from weekly_earnings(4) where name = 'Rosa Rate' and week_start = (date_trunc('week', now()) - interval '14 days')::date),
  'two weeks ago: 800 views is under the minimum, so $0');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((select count(distinct creator_id) = 1 from weekly_earnings(4)), 'a creator only sees their own weeks');

reset role;
\o
\echo ALL RATE AND WEEK CHECKS PASSED
