-- Admins can remove someone's account (and with it their videos, TikTok accounts and payouts).
-- The owner account and your own account can't be removed this way.
create function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not is_admin() then raise exception 'Only admins can remove accounts'; end if;
  if p_user = auth.uid() then raise exception 'You cannot remove your own account here'; end if;
  if exists (select 1 from profiles where id = p_user and is_owner) then raise exception 'The owner account cannot be removed'; end if;
  -- Videos keep their campaign (on delete restrict), so remove them first.
  delete from submissions where creator_id = p_user;
  delete from auth.users where id = p_user;
end $$;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
