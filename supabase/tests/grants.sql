-- Supabase's default grants, mirrored for local tests. Runs BEFORE the migrations (like on Supabase),
-- so "anon" starts with the same access it would have there and 0007 is tested for real.
grant usage on schema public to authenticated, anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, anon;
alter default privileges in schema public grant usage, select on sequences to authenticated, anon;
alter default privileges in schema public grant execute on functions to authenticated, anon;
