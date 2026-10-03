-- Only the Hypiva team (admins) approves or rejects videos. Brands can still see their videos and views.
alter policy submissions_update on public.submissions
  using (is_admin()) with check (is_admin());

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
  raise exception 'The Hypiva team reviews videos';
end $$;
revoke execute on function public.guard_submission() from authenticated, anon, public;
