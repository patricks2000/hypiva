-- Each creator sets the language they post in once (at sign-up or in their profile).
-- The posting flow then always hands out content in that language.

alter table public.profiles add column content_language text check (content_language ~ '^[a-z]{2}$');

-- Sign-up can pass the language in the account metadata; a wrong value is simply ignored.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_lang text := lower(coalesce(new.raw_user_meta_data ->> 'content_language', ''));
begin
  insert into profiles (id, name, referral_code, content_language)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new_referral_code(),
          case when v_lang ~ '^[a-z]{2}$' then v_lang end);
  if coalesce(new.raw_user_meta_data ->> 'referral_code', '') <> '' then
    begin
      perform link_referral(new.id, new.raw_user_meta_data ->> 'referral_code');
    exception when others then
      null; -- a wrong code never blocks signing up
    end;
  end if;
  return new;
end $$;
revoke execute on function public.handle_new_user() from authenticated, anon, public;
