-- Supabase grants these by default; mirrored here for local tests.
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
