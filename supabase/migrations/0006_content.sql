-- Ready-to-post content: each campaign can hold content packs (slides + title + hashtags).
-- A creator taps "Post now", picks the TikTok account and gets a pack that account has not posted yet.

alter table public.campaigns
  add column instructions text not null default '' check (length(instructions) <= 4000),
  add column requirements text[] not null default '{}' check (cardinality(requirements) <= 12);

create table public.content_packs (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  title        text not null default '' check (length(title) <= 300),       -- paste as the TikTok title
  description  text not null default '' check (length(description) <= 2000),
  hashtags     text not null default '' check (length(hashtags) <= 500),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index content_packs_campaign_idx on public.content_packs (campaign_id);

create table public.content_slides (
  id            uuid primary key default gen_random_uuid(),
  pack_id       uuid not null references public.content_packs (id) on delete cascade,
  position      integer not null default 0,
  image_url     text not null check (image_url ~* '^https?://'),
  overlay_text  text not null default '' check (length(overlay_text) <= 500)   -- add as a text overlay in TikTok
);
create index content_slides_pack_idx on public.content_slides (pack_id, position);

alter table public.submissions add column content_pack_id uuid references public.content_packs (id) on delete set null;

-- Who may manage content for a campaign: admins, or the brand that owns it.
create function public.can_manage_campaign(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select is_admin() or brand_owns_campaign(p_campaign) $$;

create function public.can_see_campaign_content(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select can_manage_campaign(p_campaign)
      or exists (select 1 from campaign_members where campaign_id = p_campaign and creator_id = auth.uid())
$$;

-- Hand out the next pack for this account: one it has not posted yet, least used overall first.
create function public.next_content(p_campaign uuid, p_account uuid) returns uuid
language plpgsql stable security definer set search_path = public
as $$
declare v uuid;
begin
  if not exists (select 1 from campaign_members where campaign_id = p_campaign and creator_id = auth.uid()) then
    raise exception 'Join this campaign first';
  end if;
  if not exists (select 1 from tiktok_accounts where id = p_account and creator_id = auth.uid()) then
    raise exception 'Use one of your own linked TikTok accounts';
  end if;
  select p.id into v
  from content_packs p
  where p.campaign_id = p_campaign and p.active
    and not exists (select 1 from submissions s where s.content_pack_id = p.id and s.tiktok_account_id = p_account)
  order by (select count(*) from submissions s where s.content_pack_id = p.id), p.created_at
  limit 1;
  return v;  -- null when this account has posted everything
end $$;
revoke all on function public.next_content(uuid, uuid) from public, anon;
grant execute on function public.next_content(uuid, uuid) to authenticated;

-- Creators may only attach content from the same campaign.
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
  return new;
end $$;

alter table public.content_packs enable row level security;
alter table public.content_slides enable row level security;

create policy packs_read on public.content_packs for select to authenticated using (can_see_campaign_content(campaign_id));
create policy packs_write on public.content_packs for all to authenticated
  using (can_manage_campaign(campaign_id)) with check (can_manage_campaign(campaign_id));

create policy slides_read on public.content_slides for select to authenticated
  using (exists (select 1 from content_packs p where p.id = pack_id and can_see_campaign_content(p.campaign_id)));
create policy slides_write on public.content_slides for all to authenticated
  using (exists (select 1 from content_packs p where p.id = pack_id and can_manage_campaign(p.campaign_id)))
  with check (exists (select 1 from content_packs p where p.id = pack_id and can_manage_campaign(p.campaign_id)));

grant select, insert, update, delete on public.content_packs, public.content_slides to authenticated;
revoke all on public.content_packs, public.content_slides from anon;

-- Image storage (Supabase only): a public "content" bucket; admins and brand users upload.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('content', 'content', true) on conflict (id) do nothing;
    execute $p$create policy "content upload by admins and brands" on storage.objects for insert to authenticated
      with check (bucket_id = 'content' and (public.is_admin() or public.my_role() = 'brand'))$p$;
    execute $p$create policy "content delete by admins" on storage.objects for delete to authenticated
      using (bucket_id = 'content' and public.is_admin())$p$;
  end if;
end $$;
