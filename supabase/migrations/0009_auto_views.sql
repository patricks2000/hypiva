-- Automatic view counts. A server job (edge function "refresh-views") reads each video's public
-- TikTok page a few times a day and stores the view count. The money maths then updates by itself.
-- It also checks that the video really belongs to the creator's linked TikTok account.

alter table public.submissions
  add column views_checked_at timestamptz,                                   -- last automatic check
  add column views_error      text check (length(views_error) <= 200),       -- why the last check failed
  add column tiktok_author    text check (length(tiktok_author) <= 60);      -- account name TikTok reports

-- Videos the job should look at: waiting or approved, posted in the last 60 days, not checked recently.
create function public.videos_to_refresh(p_limit integer default 50)
returns table (id uuid, url text, username text, views integer)
language sql stable security definer set search_path = public
as $$
  select s.id, s.url, a.username, s.views
  from submissions s join tiktok_accounts a on a.id = s.tiktok_account_id
  where s.status in ('pending', 'approved')
    and s.created_at > now() - interval '60 days'
    and (s.views_checked_at is null or s.views_checked_at < now() - interval '5 hours')
  order by s.views_checked_at nulls first
  limit greatest(1, least(p_limit, 200))
$$;
revoke all on function public.videos_to_refresh(integer) from public, anon, authenticated;

-- Store one result. Views never go down (TikTok counts only grow; a lower number is a read error).
create function public.save_video_check(p_id uuid, p_views integer, p_author text, p_error text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update submissions
     set views = case when p_error is null and p_views is not null then greatest(views, p_views) else views end,
         views_checked_at = now(),
         views_error = p_error,
         tiktok_author = coalesce(p_author, tiktok_author)
   where id = p_id;
end $$;
revoke all on function public.save_video_check(uuid, integer, text, text) from public, anon, authenticated;

-- Admins can ask for a fresh check of everything (the job then picks these up first).
create function public.request_views_refresh() returns integer
language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update submissions set views_checked_at = null
   where status in ('pending', 'approved') and created_at > now() - interval '60 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.request_views_refresh() from public, anon;
grant execute on function public.request_views_refresh() to authenticated;

-- Creators and brands cannot write these columns; the guard already blocks creators, and brands may only review.
create or replace function public.guard_submission() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or is_admin() then
    if new.views is distinct from old.views then new.views_updated_at := now(); end if;
    if new.status is distinct from old.status and new.status <> 'pending' then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    end if;
    return new;
  end if;
  if brand_owns_campaign(old.campaign_id) then
    if (new.campaign_id, new.creator_id, new.tiktok_account_id, new.url, new.views, new.views_updated_at, new.created_at,
        new.views_checked_at, new.views_error, new.tiktok_author)
       is distinct from (old.campaign_id, old.creator_id, old.tiktok_account_id, old.url, old.views, old.views_updated_at, old.created_at,
        old.views_checked_at, old.views_error, old.tiktok_author) then
      raise exception 'Brands can only approve or reject videos';
    end if;
    new.reviewed_by := auth.uid(); new.reviewed_at := now();
    return new;
  end if;
  raise exception 'Not allowed';
end $$;

-- New videos start unchecked.
create or replace function public.guard_new_submission() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.content_pack_id is not null and not exists (
       select 1 from content_packs where id = new.content_pack_id and campaign_id = new.campaign_id) then
    raise exception 'This content belongs to another campaign';
  end if;
  if auth.uid() is null or is_admin() then return new; end if;
  if new.creator_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if not exists (select 1 from tiktok_accounts where id = new.tiktok_account_id and creator_id = auth.uid()) then
    raise exception 'Use one of your own linked TikTok accounts';
  end if;
  if not exists (select 1 from campaign_members m join campaigns c on c.id = m.campaign_id
                 where m.campaign_id = new.campaign_id and m.creator_id = auth.uid() and c.status = 'live') then
    raise exception 'Join this campaign first';
  end if;
  new.status := 'pending'; new.views := 0; new.views_updated_at := null;
  new.reviewed_by := null; new.reviewed_at := null; new.reject_reason := null; new.created_at := now();
  new.views_checked_at := null; new.views_error := null; new.tiktok_author := null;
  return new;
end $$;
revoke execute on function public.guard_submission() from authenticated, anon, public;
revoke execute on function public.guard_new_submission() from authenticated, anon, public;

-- Schedule (Supabase only): call the edge function every 3 hours with a secret only the database knows.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net')
     and exists (select 1 from information_schema.schemata where schema_name = 'vault') then
    create extension if not exists pg_net with schema extensions;
    create extension if not exists pg_cron;
    if not exists (select 1 from vault.secrets where name = 'refresh_views_secret') then
      perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'refresh_views_secret');
    end if;
  end if;
end $$;

-- The edge function checks the secret through this (service key only).
create function public.check_refresh_secret(p_secret text) returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare ok boolean := false;
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'vault') then
    execute 'select exists (select 1 from vault.decrypted_secrets where name = ''refresh_views_secret'' and decrypted_secret = $1)'
      into ok using p_secret;
  end if;
  return coalesce(ok, false);
end $$;
revoke all on function public.check_refresh_secret(text) from public, anon, authenticated;
