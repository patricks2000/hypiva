-- Run once in Supabase: SQL Editor, after you created your own account in the app.
-- Replace the email with the one you signed up with. This makes you the owner:
-- the only person who can give or take away Brand and Admin access.
update public.profiles
set role = 'admin', is_owner = true
where id = (select id from auth.users where email = 'YOUR-EMAIL@example.com');
