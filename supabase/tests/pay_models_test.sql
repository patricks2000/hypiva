-- Pay per video, pay-term protection and content languages.
\set ON_ERROR_STOP 1
set client_min_messages = notice;
\pset tuples_only on
\o /dev/null
reset role;
create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false); end $$;
create function pg_temp.check(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok  %', what; end $$;

select pg_temp.check(video_pay_cents(500, 1000, 200, null) = 0 and video_pay_cents(1500, 1000, 200, null) = 300, 'per views: same rule as before');
select pg_temp.check(video_pay_cents(40, 0, 200, 500) = 500 and video_pay_cents(999, 1000, 200, 500) = 0 and video_pay_cents(80000, 1000, 200, 500) = 500,
  'fixed per video: $5 once the video reaches the minimum, however many views');

select pg_temp.as_user(null);
insert into campaigns (id, brand_id, name, cpm_cents, budget_cents, fixed_cents, min_views) values
 ('20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-000000000001', 'Macro Snap: $5 per post', 100, 100000, 500, 0);
insert into campaign_members (campaign_id, creator_id) values ('20000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000b');
insert into submissions (id, campaign_id, creator_id, tiktok_account_id, url, views, status) values
 ('40000000-0000-0000-0000-0000000000f1', '20000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 'https://www.tiktok.com/@alex/video/f1', 50, 'approved'),
 ('40000000-0000-0000-0000-0000000000f2', '20000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 'https://www.tiktok.com/@alex/video/f2', 30000, 'approved'),
 ('40000000-0000-0000-0000-0000000000f3', '20000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 'https://www.tiktok.com/@alex/video/f3', 0, 'pending');

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select sum(earned_cents) = 1000 from submission_earnings where campaign_id = '20000000-0000-0000-0000-0000000000f1'),
  'two approved videos in a $5-per-video campaign earn $10; the one waiting for review earns nothing yet');
select pg_temp.check((select earned_cents >= 1000 from creator_balances), 'the fixed amounts count in what the creator is owed');

select pg_temp.check((select coalesce(sum(video_cents), 0) >= 1000 from weekly_earnings(1)), 'fixed pay per video shows up in this week''s money');
select pg_temp.check((select earned_cents is null from leaderboard() where is_me), 'creators never see money on the leaderboard');
-- The brand cannot change pay terms, only things like pausing
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin update campaigns set cpm_cents = 1 where id = '20000000-0000-0000-0000-000000000001'; raise exception 'FAILED: brand lowered the rate'; exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end $$;
do $$ begin update campaigns set fixed_cents = 1 where id = '20000000-0000-0000-0000-0000000000f1'; raise exception 'FAILED: brand changed the fixed amount'; exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end $$;
update campaigns set status = 'paused' where id = '20000000-0000-0000-0000-0000000000f1';
select pg_temp.check((select status = 'paused' and fixed_cents = 500 from campaigns where id = '20000000-0000-0000-0000-0000000000f1'), 'a brand can pause its campaign but not change the pay');

-- The owner can change pay terms any time
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update campaigns set fixed_cents = 800, status = 'live' where id = '20000000-0000-0000-0000-0000000000f1';
update campaigns set fixed_cents = null, cpm_cents = 300 where id = '20000000-0000-0000-0000-0000000000f1';
select pg_temp.check((select fixed_cents is null and cpm_cents = 300 from campaigns where id = '20000000-0000-0000-0000-0000000000f1'), 'the owner can switch a campaign between per video and per views');
update campaigns set fixed_cents = 500, cpm_cents = 100 where id = '20000000-0000-0000-0000-0000000000f1';
select pg_temp.check((select earned_cents >= 1000 from leaderboard() where creator_id = '00000000-0000-0000-0000-00000000000b'), 'the leaderboard counts fixed pay per video for this month');
update campaigns set fixed_cents = 500, cpm_cents = 100 where id = '20000000-0000-0000-0000-0000000000f1';

-- Content in the creator's language
insert into content_packs (id, campaign_id, title, language) values
 ('50000000-0000-0000-0000-0000000000e1', '20000000-0000-0000-0000-0000000000f1', 'English post', 'en'),
 ('50000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000f1', 'Nederlandse post', 'nl');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(next_content('20000000-0000-0000-0000-0000000000f1', '30000000-0000-0000-0000-000000000001', 'nl') = '50000000-0000-0000-0000-0000000000d1', 'a Dutch creator gets Dutch content');
select pg_temp.check(next_content('20000000-0000-0000-0000-0000000000f1', '30000000-0000-0000-0000-000000000001', 'en') = '50000000-0000-0000-0000-0000000000e1', 'an English creator gets English content');
select pg_temp.check(next_content('20000000-0000-0000-0000-0000000000f1', '30000000-0000-0000-0000-000000000001', 'de') is null, 'no German content means nothing is handed out in the wrong language');
reset role;

-- Language set once at sign-up, changeable by the creator only
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000d7', 'daan@example.com', '{"name":"Daan","content_language":"nl"}'),
 ('00000000-0000-0000-0000-0000000000d8', 'bad@example.com', '{"name":"X","content_language":"<script>"}');
select pg_temp.check((select content_language = 'nl' from profiles where id = '00000000-0000-0000-0000-0000000000d7'), 'the language chosen at sign-up is saved');
select pg_temp.check((select content_language is null from profiles where id = '00000000-0000-0000-0000-0000000000d8'), 'a nonsense language is ignored and sign-up still works');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d7');
update profiles set content_language = 'de' where id = '00000000-0000-0000-0000-0000000000d7';
select pg_temp.check((select content_language = 'de' from profiles where id = '00000000-0000-0000-0000-0000000000d7'), 'a creator can change their own posting language');
reset role;

\o
\echo ALL PAY MODEL AND LANGUAGE CHECKS PASSED
