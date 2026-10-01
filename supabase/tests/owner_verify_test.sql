-- Owner set-up, paused brand campaigns, account verification.
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

-- The test data already has an owner, so the owner email must NOT take over.
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values ('00000000-0000-0000-0000-00000000c0e1', 'PatrickKruiger@iCloud.com', '{"name":"Patrick"}', now());
select pg_temp.check((select role = 'creator' and not is_owner from profiles where id = '00000000-0000-0000-0000-00000000c0e1'), 'when an owner exists, the owner email gets no extra rights');

-- With no owner yet: unconfirmed does nothing, confirming makes the owner
update profiles set is_owner = false where is_owner;
delete from auth.users where id = '00000000-0000-0000-0000-00000000c0e1';
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000c0e2', 'patrickkruiger@icloud.com', '{"name":"Patrick"}');
select pg_temp.check((select role = 'creator' and not is_owner from profiles where id = '00000000-0000-0000-0000-00000000c0e2'), 'an unconfirmed sign-up with the owner email is still a normal creator');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000c0e2';
select pg_temp.check((select role = 'admin' and is_owner from profiles where id = '00000000-0000-0000-0000-00000000c0e2'), 'confirming the owner email makes Patrick admin and owner');
-- Also works when the email is confirmed straight away at sign-up
update profiles set is_owner = false, role = 'creator' where id = '00000000-0000-0000-0000-00000000c0e2';
delete from auth.users where id = '00000000-0000-0000-0000-00000000c0e2';
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-00000000c0e4', 'patrickkruiger@icloud.com', now());
select pg_temp.check((select is_owner from profiles where id = '00000000-0000-0000-0000-00000000c0e4'), 'owner also set when the email is confirmed at sign-up');
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-00000000c0e3', 'someone@else.com', now());
select pg_temp.check((select role = 'creator' from profiles where id = '00000000-0000-0000-0000-00000000c0e3'), 'other people stay creators');
select pg_temp.check((select count(*) = 1 from profiles where is_owner), 'there is exactly one owner');
-- restore the original owner for later tests
update profiles set is_owner = false, role = 'creator' where id = '00000000-0000-0000-0000-00000000c0e4';
update profiles set is_owner = true where id = '00000000-0000-0000-0000-00000000000a';

-- Brand-made campaigns start paused; brands cannot make them live
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into campaigns (id, brand_id, name, cpm_cents, budget_cents, status) values ('20000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000001', 'Brand made', 5000, 100000, 'live');
select pg_temp.check((select status = 'paused' from campaigns where id = '20000000-0000-0000-0000-0000000000b1'), 'a campaign a brand creates starts paused');
do $$ begin update campaigns set status = 'live' where id = '20000000-0000-0000-0000-0000000000b1'; raise exception 'FAILED: brand made it live'; exception when raise_exception then if sqlerrm like 'FAILED%' then raise; end if; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update campaigns set status = 'live' where id = '20000000-0000-0000-0000-0000000000b1';
select pg_temp.check((select status = 'live' from campaigns where id = '20000000-0000-0000-0000-0000000000b1'), 'the owner checks it and makes it live');

-- Verification: every account has a code; creators cannot verify themselves
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into tiktok_accounts (creator_id, username) values ('00000000-0000-0000-0000-00000000000c', 'nina.second');
select pg_temp.check((select verify_code ~ '^HY-[0-9A-F]{6}$' and not verified from tiktok_accounts where username = 'nina.second'), 'a new account gets a code like HY-3F9A2C and is not verified');
update tiktok_accounts set verified = true where username = 'nina.second';
do $$ begin perform mark_account_verified((select id from tiktok_accounts where username = 'nina.second')); raise exception 'FAILED: creator verified itself'; exception when insufficient_privilege then null; end $$;
reset role;
select pg_temp.check((select not verified from tiktok_accounts where username = 'nina.second'), 'a creator cannot mark their own account verified');
select mark_account_verified((select id from tiktok_accounts where username = 'nina.second'));
select pg_temp.check((select verified and verified_at is not null from tiktok_accounts where username = 'nina.second'), 'the server check marks it verified');

-- Brands see reach, not what creators are paid
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) > 0 and bool_and(spent_cents is null) from campaign_stats), 'a brand sees views and videos but not what creators cost');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select bool_and(spent_cents is not null) from campaign_stats), 'the owner sees the creator costs');
reset role;

-- Campaign requests: only admins can read them, nobody signed in can write them directly
reset role;
insert into brand_leads (name, email, company, budget, currency, message) values ('Lisa', 'lisa@fitapp.com', 'FitApp', '2000_5000', 'EUR', 'Test');
do $$ begin insert into brand_leads (name, email, budget) values ('x', 'x@x.com', 'a million'); raise exception 'FAILED: free-text budget accepted'; exception when check_violation then null; end $$;
do $$ begin insert into brand_leads (name, email, currency) values ('x', 'x@x.com', 'BTC'); raise exception 'FAILED: odd currency accepted'; exception when check_violation then null; end $$;
select pg_temp.check(true, 'requests only accept the budget ranges and USD or EUR');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 0 from brand_leads), 'creators cannot see campaign requests');
do $$ begin insert into brand_leads (name, email) values ('x', 'x@x.com'); raise exception 'FAILED: creator inserted a lead'; exception when insufficient_privilege then null; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) = 1 from brand_leads), 'the owner sees campaign requests');
reset role;

\o
\echo ALL OWNER AND VERIFY CHECKS PASSED
