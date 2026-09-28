-- Payout details stay private. Runs after the other tests.
\set ON_ERROR_STOP 1
set client_min_messages = notice;
\pset tuples_only on
\o /dev/null
reset role;
create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false); end $$;
create function pg_temp.check(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok  %', what; end $$;

set role authenticated;
-- Alex (creator of the Macro Snap videos) saves his IBAN
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into payout_accounts (creator_id, method, details) values ('00000000-0000-0000-0000-00000000000b', 'bank', 'NL00 BANK 0123 4567 89, A. Rivera');
select pg_temp.check((select count(*) = 1 from payout_accounts), 'Alex sees his own payout details');
do $$ begin insert into payout_accounts (creator_id, method, details) values ('00000000-0000-0000-0000-00000000000c', 'paypal', 'thief@example.com'); exception when others then null; end $$;
reset role;
select pg_temp.check((select count(*) = 0 from payout_accounts where creator_id = '00000000-0000-0000-0000-00000000000c'), 'nobody can set payout details for someone else');
set role authenticated;

-- The brand user can see Alex's name (he posts for them) but not how he gets paid
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) >= 1 from profiles where id = '00000000-0000-0000-0000-00000000000b'), 'the brand sees the creator''s name');
select pg_temp.check((select count(*) = 0 from payout_accounts), 'the brand cannot see any IBAN or PayPal');
select pg_temp.check((select count(*) = 0 from information_schema.columns where table_name = 'profiles' and column_name like 'payout%'), 'profiles no longer hold payout details');

-- Another creator cannot see it either
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) = 0 from payout_accounts), 'other creators cannot see it');

-- The owner can, to send the money
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select details like 'NL00%' from payout_accounts where creator_id = '00000000-0000-0000-0000-00000000000b'), 'the owner sees where to send the money');
update payout_accounts set details = 'hacked' where creator_id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select details like 'NL00%' from payout_accounts where creator_id = '00000000-0000-0000-0000-00000000000b'), 'even an admin cannot change a creator''s bank details');

-- Signed-out visitors see nothing
reset role;
set role anon;
select pg_temp.as_user(null);
do $$ begin perform 1 from payout_accounts; raise exception 'FAILED: anon could read payout accounts'; exception when insufficient_privilege then null; end $$;
do $$ begin perform 1 from profiles; raise exception 'FAILED: anon could read profiles'; exception when insufficient_privilege then null; end $$;
reset role;
select pg_temp.check(true, 'signed-out visitors cannot read profiles or payout details');

\o
\echo ALL PRIVACY CHECKS PASSED
