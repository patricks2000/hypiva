-- Manual bonuses and the monthly leaderboard. Runs after the other tests.
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
-- Rosa ($1 rate, 5,000 views = $5.00) gets a manual bonus
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$ begin insert into bonuses (creator_id, amount_cents, reason) values ('00000000-0000-0000-0000-0000000000e1', 99999, 'me'); exception when others then null; end $$;
select pg_temp.check((select count(*) = 0 from bonuses), 'a creator cannot give themself a bonus');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into bonuses (creator_id, amount_cents, reason) values ('00000000-0000-0000-0000-0000000000e1', 5000, 'Top creator of the month');
select pg_temp.check((select earned_cents = 5500 and bonus_cents = 5000 and owed_cents = 5500 from creator_balances where creator_id = '00000000-0000-0000-0000-0000000000e1'),
  'the owner gives Rosa a $50 bonus: she is now owed $55.00');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((select count(*) = 1 and min(reason) = 'Top creator of the month' from bonuses), 'Rosa sees her bonus and why she got it');
select pg_temp.check((select (request_payout()).amount_cents = 5500), 'Rosa can withdraw the bonus with her earnings');

-- Leaderboard: hidden until the owner turns it on
select pg_temp.check((select count(*) = 0 from leaderboard()), 'creators do not see the leaderboard while it is off');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) > 0 and bool_and(earned_cents is not null) from leaderboard()), 'the owner always sees it, with earnings');
update leaderboard_settings set visible = true, prize_text = '$50 for #1 this month';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((select count(*) > 0 and bool_and(earned_cents is null) from leaderboard()), 'once on, creators see it without anyone''s money');
select pg_temp.check((select count(*) = 1 from leaderboard() where is_me), 'Rosa sees her own place');
select pg_temp.check((select count(creator_id) = 1 from leaderboard()), 'creators cannot see other people''s account ids');
select pg_temp.check((select bool_and(first_name !~ ' ') from leaderboard()), 'only first names are shown');
update leaderboard_settings set visible = false;
select pg_temp.check((select visible from leaderboard_settings), 'a creator cannot turn the leaderboard off');

reset role;
\o
\echo ALL BONUS AND LEADERBOARD CHECKS PASSED

-- Exchange rate: admins read it, only the owner sets it, creators never see it
\o /dev/null
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update app_settings set eur_per_usd = 0.86;
select pg_temp.check((select eur_per_usd = 0.86 from app_settings), 'the owner sets $1 = €0.86');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((select count(*) = 0 from app_settings), 'creators cannot see the exchange rate');
update app_settings set eur_per_usd = 5;
reset role;
select pg_temp.check((select eur_per_usd = 0.86 from app_settings), 'creators cannot change it');
\o
\echo ALL EXCHANGE RATE CHECKS PASSED
