-- Checks the money rules and who-can-see-what on a local Postgres.
-- Run: psql -f tests/auth_stub.sql -f migrations/0001_init.sql -f tests/grants.sql -f tests/rules_test.sql
\set ON_ERROR_STOP 1
set client_min_messages = notice;
\pset tuples_only on
\o /dev/null

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false); end $$;

create function pg_temp.check(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok  %', what; end $$;

create function pg_temp.fails(stmt text, what text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice 'ok  % (%)', what, sqlerrm; return; end;
  raise exception 'FAILED (should have been refused): %', what;
end $$;

-- people
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'owner@example.com',  '{"name":"Owner"}'),
 ('00000000-0000-0000-0000-00000000000b', 'alex@example.com',   '{"name":"Alex"}'),
 ('00000000-0000-0000-0000-00000000000c', 'nina@example.com',   '{"name":"Nina"}'),
 ('00000000-0000-0000-0000-00000000000d', 'brand@example.com',  '{"name":"Brand person"}'),
 ('00000000-0000-0000-0000-00000000000e', 'friend@example.com', '{"name":"Friend"}');

-- one-time setup, done by hand in the Supabase SQL editor
update profiles set role = 'admin', is_owner = true where id = '00000000-0000-0000-0000-00000000000a';
insert into brands (id, name) values ('10000000-0000-0000-0000-000000000001', 'Macro Snap'), ('10000000-0000-0000-0000-000000000002', 'Other Co');
update profiles set role = 'brand', brand_id = '10000000-0000-0000-0000-000000000001' where id = '00000000-0000-0000-0000-00000000000d';
insert into campaigns (id, brand_id, name, cpm_cents, budget_cents) values
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Macro Snap: Repost', 200, 500000),
 ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Other Co: Clips',    300, 100000);

select pg_temp.check(video_earnings_cents(999, 1000, 200) = 0,    '999 views on one video earns $0');
select pg_temp.check(video_earnings_cents(1000, 1000, 200) = 200, '1,000 views on one video earns $2.00');
select pg_temp.check(video_earnings_cents(1500, 1000, 200) = 300, '1,500 views on one video earns $3.00');

set role authenticated;

-- Alex (creator) joins, links an account and posts three videos
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into campaign_members (campaign_id, creator_id) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b');
insert into tiktok_accounts (id, creator_id, username) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'alex.getsfit4');
insert into submissions (id, campaign_id, creator_id, tiktok_account_id, url, views, status) values
 ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 'https://www.tiktok.com/@alex/video/1', 99999, 'approved'),
 ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 'https://www.tiktok.com/@alex/video/2', 0, 'pending'),
 ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 'https://www.tiktok.com/@alex/video/3', 0, 'pending');
select pg_temp.check((select views = 0 and status = 'pending' from submissions where id = '40000000-0000-0000-0000-000000000001'),
  'a creator cannot send in a video with made-up views or pre-approved');
select pg_temp.fails($$update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000b'$$, 'a creator cannot make themself admin');
update submissions set views = 50000 where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.check((select views = 0 from submissions where id = '40000000-0000-0000-0000-000000000001'), 'a creator cannot change views');
select pg_temp.fails($$insert into payouts (creator_id, amount_cents) values ('00000000-0000-0000-0000-00000000000b', 100000)$$, 'a creator cannot write a payout directly');
select pg_temp.fails($$insert into submissions (campaign_id, creator_id, tiktok_account_id, url) values ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 'https://www.tiktok.com/@alex/video/9')$$,
  'a creator cannot post to a campaign they did not join');

-- Nina (creator) posts too
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into campaign_members (campaign_id, creator_id) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c');
insert into tiktok_accounts (id, creator_id, username) values ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'nina.brooks_92');
select pg_temp.fails($$insert into submissions (campaign_id, creator_id, tiktok_account_id, url) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-000000000001', 'https://www.tiktok.com/@alex/video/8')$$,
  'a creator cannot post with someone else''s TikTok account');
insert into submissions (id, campaign_id, creator_id, tiktok_account_id, url) values
 ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-000000000002', 'https://www.tiktok.com/@nina/video/1');
select pg_temp.check((select count(*) = 1 from submissions), 'Nina only sees her own video');
select pg_temp.check((select count(*) = 0 from profiles where id <> '00000000-0000-0000-0000-00000000000c'), 'Nina cannot see other people''s profiles');

-- Brands see their videos but the Hypiva team does the reviewing
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) = 4 from submissions), 'the brand sees the videos for its campaign');
update submissions set status = 'approved', views = 9000 where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.check((select status = 'pending' and views = 0 from submissions where id = '40000000-0000-0000-0000-000000000001'), 'a brand cannot approve videos or change views');
select pg_temp.check((select count(*) = 0 from creator_balances), 'a brand cannot see what creators are owed');
select pg_temp.check((select count(*) = 0 from payouts), 'a brand cannot see payouts');

-- Owner approves the videos and enters views: 500, 800 and 1,000 on Alex's three videos
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update submissions set status = 'approved' where id in ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000004');
update submissions set views = 500  where id = '40000000-0000-0000-0000-000000000001';
update submissions set views = 800  where id = '40000000-0000-0000-0000-000000000002';
update submissions set views = 1000 where id = '40000000-0000-0000-0000-000000000003';
update submissions set views = 2500 where id = '40000000-0000-0000-0000-000000000004';
select pg_temp.check((select earned_cents = 200 and paid_videos = 1 and videos = 3 from creator_balances where creator_id = '00000000-0000-0000-0000-00000000000b'),
  'Alex: 3 videos, only one reached 1,000 views, so he earned $2.00 (not $4.60 for 2,300 views combined)');
select pg_temp.check((select earned_cents = 500 from creator_balances where creator_id = '00000000-0000-0000-0000-00000000000c'), 'Nina: 2,500 views earns $5.00');
select pg_temp.check((select count(*) = 3 from creator_balances), 'the owner sees every creator (Alex, Nina, Friend)');

-- Alex sees only his own money
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 1 and min(earned_cents) = 200 from creator_balances), 'Alex only sees his own balance');
select pg_temp.fails($$select request_payout()$$, 'no payout request below $10');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update submissions set views = 6000 where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select (request_payout()).amount_cents = 1400), 'Alex requests $14.00 ($12 + $2)');
select pg_temp.fails($$select request_payout()$$, 'only one open request at a time');
select pg_temp.fails($$select mark_creator_paid('00000000-0000-0000-0000-00000000000b')$$, 'a creator cannot mark himself paid');

-- Roles: only the owner hands them out
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select set_user_role('00000000-0000-0000-0000-00000000000e', 'admin');
select pg_temp.check((select role = 'admin' from profiles where id = '00000000-0000-0000-0000-00000000000e'), 'the owner made Friend an admin');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.fails($$select set_user_role('00000000-0000-0000-0000-00000000000c', 'admin')$$, 'an admin who is not the owner cannot hand out roles');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select role = 'creator' from profiles where id = '00000000-0000-0000-0000-00000000000c'), 'an admin cannot change roles with a direct update');
select pg_temp.fails($$update profiles set is_owner = true where id = '00000000-0000-0000-0000-00000000000e'$$, 'an admin cannot make themself owner');
select pg_temp.check((select mark_creator_paid('00000000-0000-0000-0000-00000000000b') = 1400), 'an admin marks Alex paid: $14.00');
select pg_temp.check((select owed_cents = 0 and paid_cents = 1400 from creator_balances where creator_id = '00000000-0000-0000-0000-00000000000b'), 'Alex now owed $0');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select set_user_role('00000000-0000-0000-0000-00000000000a', 'creator')$$, 'the owner cannot demote themself by accident');
select set_user_role('00000000-0000-0000-0000-00000000000e', 'creator');
select pg_temp.check((select role = 'creator' from profiles where id = '00000000-0000-0000-0000-00000000000e'), 'the owner took admin away again');

reset role;
\o
\echo ALL RULE CHECKS PASSED
