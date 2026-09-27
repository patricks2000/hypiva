-- Ready-to-post content. Runs after the other tests.
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

set role authenticated;
-- The brand user (d) owns campaign ...01 (Macro Snap) and adds two packs
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
update campaigns set instructions = 'Create a new account and upload the content.', requirements = array['Post from a linked account', 'Use the given title'] where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.check((select cardinality(requirements) = 2 from campaigns where id = '20000000-0000-0000-0000-000000000001'), 'the brand writes instructions and a checklist');
insert into content_packs (id, campaign_id, title, hashtags) values
 ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '5 TOP ab exercises', '#fit #core'),
 ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'What I eat in a day', '#food');
insert into content_slides (pack_id, position, image_url, overlay_text) values
 ('50000000-0000-0000-0000-000000000001', 0, 'https://example.com/1.jpg', '5 TOP ab exercises'),
 ('50000000-0000-0000-0000-000000000001', 1, 'https://example.com/2.jpg', 'Plank');
select pg_temp.fails($$insert into content_packs (campaign_id, title) values ('20000000-0000-0000-0000-000000000002', 'not mine')$$, 'a brand cannot add content to another brand''s campaign');

-- Liam (creator, not in rules test campaign 01? he is not a member) cannot see it
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');   -- Rosa is a member of 01
select pg_temp.check((select count(*) = 2 from content_packs), 'a creator in the campaign sees its content');
select pg_temp.check((select count(*) = 2 from content_slides), 'and the slides');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');   -- Friend: not a member
select pg_temp.check((select count(*) = 0 from content_packs), 'a creator outside the campaign does not');
select pg_temp.fails($$insert into content_packs (campaign_id, title) values ('20000000-0000-0000-0000-000000000001', 'x')$$, 'creators cannot add content');

-- Rosa posts with her account: she gets pack 1, then pack 2, then nothing new
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((select next_content('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000e1') = '50000000-0000-0000-0000-000000000001'), 'Post now gives Rosa the first pack');
insert into submissions (campaign_id, creator_id, tiktok_account_id, url, content_pack_id) values
 ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', '30000000-0000-0000-0000-0000000000e1', 'https://www.tiktok.com/@rosa/video/2', '50000000-0000-0000-0000-000000000001');
select pg_temp.check((select next_content('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000e1') = '50000000-0000-0000-0000-000000000002'), 'after posting it, she gets the next pack');
insert into submissions (campaign_id, creator_id, tiktok_account_id, url, content_pack_id) values
 ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', '30000000-0000-0000-0000-0000000000e1', 'https://www.tiktok.com/@rosa/video/3', '50000000-0000-0000-0000-000000000002');
select pg_temp.check((select next_content('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000e1') is null), 'when the account posted everything, there is nothing new');
select pg_temp.fails($$select next_content('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001')$$, 'you cannot ask content for someone else''s account');

reset role;
select pg_temp.as_user(null);
insert into content_packs (id, campaign_id, title) values ('50000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000002', 'other');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.fails($$insert into submissions (campaign_id, creator_id, tiktok_account_id, url, content_pack_id) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', '30000000-0000-0000-0000-0000000000e1', 'https://www.tiktok.com/@rosa/video/4', '50000000-0000-0000-0000-000000000009')$$,
  'content from another campaign cannot be attached');

reset role;
\o
\echo ALL CONTENT CHECKS PASSED
