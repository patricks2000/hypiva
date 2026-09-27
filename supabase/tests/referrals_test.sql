-- Invite program checks. Runs after rules_test.sql (reuses its campaign and the owner).
\set ON_ERROR_STOP 1
set client_min_messages = notice;
\pset tuples_only on
\o /dev/null
reset role;

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false); end $$;
create function pg_temp.check(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok  %', what; end $$;
create function pg_temp.fails(stmt text, what text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice 'ok  % (%)', what, sqlerrm; return; end;
  raise exception 'FAILED (should have been refused): %', what;
end $$;

-- Inviter signs up and gets a code
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000f1', 'inviter@example.com', '{"name":"Ivy Inviter"}');
select pg_temp.check((select referral_code ~ '^VT[A-Z2-9]{6}$' from profiles where id = '00000000-0000-0000-0000-0000000000f1'), 'every new account gets an invite code like VTX7K2QA');

-- Friend signs up with that code
insert into auth.users (id, email, raw_user_meta_data)
select '00000000-0000-0000-0000-0000000000f2', 'friend2@example.com', jsonb_build_object('name', 'Finn Friend', 'referral_code', lower(referral_code))
from profiles where id = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.check((select referrer_id = '00000000-0000-0000-0000-0000000000f1' from referrals where referred_id = '00000000-0000-0000-0000-0000000000f2'),
  'signing up with a code links the new creator to the inviter');
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000f3', 'friend3@example.com', '{"name":"Fay","referral_code":"NOPE"}');
select pg_temp.check((select count(*) = 1 from profiles where id = '00000000-0000-0000-0000-0000000000f3'), 'a wrong code never blocks signing up');

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select pg_temp.fails($$select use_referral_code((select 'VT' || 'XXXXXX'))$$, 'an unknown code is refused');
select pg_temp.fails($$update profiles set referral_code = 'VTMYOWN1' where id = '00000000-0000-0000-0000-0000000000f3'$$, 'nobody can change their own code');
reset role;
select set_config('viewtra.code', (select referral_code from profiles where id = '00000000-0000-0000-0000-0000000000f3'), false);
set role authenticated;
select pg_temp.fails($$select use_referral_code(current_setting('viewtra.code'))$$, 'you cannot use your own code');
reset role;
select set_config('viewtra.code', (select referral_code from profiles where id = '00000000-0000-0000-0000-0000000000f1'), false);
set role authenticated;
select use_referral_code(current_setting('viewtra.code'));
select pg_temp.check((select count(*) = 1 from referrals where referred_id = '00000000-0000-0000-0000-0000000000f3'), 'Fay adds Ivy''s code in the app');
select pg_temp.fails($$select use_referral_code(current_setting('viewtra.code'))$$, 'a code can only be used once per creator');
select pg_temp.fails($$insert into referrals (referred_id, referrer_id) values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3')$$,
  'nobody can write an invite link directly');

-- Finn posts: 10,000 views ($20.00) and 900 views ($0); one more video after the 6 months
reset role;
select pg_temp.as_user(null);
insert into campaign_members values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f2', now());
insert into tiktok_accounts (id, creator_id, username) values ('30000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f2', 'finn.fit');
insert into submissions (campaign_id, creator_id, tiktok_account_id, url, status, views, created_at) values
 ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f2', '30000000-0000-0000-0000-0000000000f2', 'https://www.tiktok.com/@finn/video/1', 'approved', 10000, now()),
 ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f2', '30000000-0000-0000-0000-0000000000f2', 'https://www.tiktok.com/@finn/video/2', 'approved', 900, now()),
 ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f2', '30000000-0000-0000-0000-0000000000f2', 'https://www.tiktok.com/@finn/video/3', 'approved', 50000, now() + interval '7 months');

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.check((select referral_earned_cents = 100 and earned_cents = 100 and invites = 2 from creator_balances),
  'Ivy earns 5% of Finn''s $20.00 = $1.00 (the 900-view video and the video after 6 months do not count)');
select pg_temp.check((select count(*) = 2 and bool_and(first_name in ('Finn', 'Fay')) from my_referrals()), 'Ivy sees her invites by first name');
select pg_temp.check((select count(*) = 0 from submissions where creator_id = '00000000-0000-0000-0000-0000000000f2'), 'Ivy cannot see Finn''s videos');
select pg_temp.check((select count(*) = 1 from creator_balances), 'Ivy only sees her own balance');
update referral_settings set percent_bp = 5000;
select pg_temp.check((select percent_bp = 500 from referral_settings), 'a creator cannot change the invite rules');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select pg_temp.check((select earned_cents = 12000 and referral_earned_cents = 0 from creator_balances), 'Finn keeps all his earnings ($20 + $100); the bonus is paid on top');

-- Owner lowers the cap to $0.50: Ivy's bonus from Finn stops there
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update referral_settings set cap_cents = 50;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.check((select referral_earned_cents = 50 from creator_balances), 'the maximum per invited creator is respected ($0.50)');
select pg_temp.check((select bool_or(capped) from my_referrals()), 'the list shows that the maximum is reached');

reset role;
\o
\echo ALL INVITE CHECKS PASSED
