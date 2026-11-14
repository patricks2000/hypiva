-- New review on hypiva.com/write-review: the owner gets an email (edge function "notify-review", when an email key is set).
-- Same setup as the sign-up notification: call the edge function with the refresh secret from the vault.
create or replace function public.notify_review() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net')
     and exists (select 1 from information_schema.schemata where schema_name = 'vault') then
    begin
      execute $q$select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/notify-review',
        headers := jsonb_build_object('Content-Type', 'application/json',
          'x-refresh-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'refresh_views_secret')),
        body := jsonb_build_object('id', $1))$q$ using new.id;
    exception when others then
      null; -- a failed notification never blocks leaving a review
    end;
  end if;
  return new;
end $$;
revoke execute on function public.notify_review() from authenticated, anon, public;
drop trigger if exists notify_review on public.reviews;
create trigger notify_review after insert on public.reviews
  for each row execute function public.notify_review();
