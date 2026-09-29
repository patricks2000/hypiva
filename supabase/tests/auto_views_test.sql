-- Automatic view counts: only the server job can save them, views never go down.
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
create temp table pick as select * from videos_to_refresh(500);
select pg_temp.check((select count(*) > 0 from pick), 'the job finds recent videos to check');
select pg_temp.check((select bool_and(username is not null) from pick), 'each video comes with the linked TikTok account name');

-- Save a check: views go up, and a lower number is ignored
select save_video_check((select id from pick limit 1), 999999, 'someone', null);
select pg_temp.check((select views = 999999 and views_error is null and views_checked_at is not null from submissions where id = (select id from pick limit 1)), 'a check saves the new view count');
select save_video_check((select id from pick limit 1), 5, null, null);
select pg_temp.check((select views = 999999 from submissions where id = (select id from pick limit 1)), 'views never go down from a bad read');
select save_video_check((select id from pick limit 1), null, 'other', 'This video is from @other, not @alex.fit');
select pg_temp.check((select views = 999999 and views_error like 'This video is from%' from submissions where id = (select id from pick limit 1)), 'a failed check keeps the views and shows why');
select pg_temp.check((select count(*) = 0 from videos_to_refresh(500) where id = (select id from pick limit 1)), 'a checked video waits a few hours before the next check');

-- Nobody signed in can run the job functions or fake a result
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin perform save_video_check(gen_random_uuid(), 1, null, null); raise exception 'FAILED: creator could save views'; exception when insufficient_privilege then null; end $$;
do $$ begin perform videos_to_refresh(5); raise exception 'FAILED: creator could list the job'; exception when insufficient_privilege then null; end $$;
do $$ begin perform check_refresh_secret('x'); raise exception 'FAILED: creator could test secrets'; exception when insufficient_privilege then null; end $$;
do $$ begin perform request_views_refresh(); raise exception 'FAILED: creator could force a refresh'; exception when others then null; end $$;
reset role;
select pg_temp.check(true, 'creators cannot run the job, save views or force a refresh');

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select request_views_refresh() > 0), 'the owner can ask for a fresh check of all videos');
reset role;

\o
\echo ALL AUTO VIEWS CHECKS PASSED
