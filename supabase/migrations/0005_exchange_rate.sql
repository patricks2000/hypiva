-- Amounts stay in dollars. The owner can set a dollar-to-euro rate so the app shows
-- what to transfer from a euro bank account ("$90.00 ≈ €77.40").
create table public.app_settings (
  id           boolean primary key default true check (id),
  eur_per_usd  numeric(8, 4) check (eur_per_usd > 0 and eur_per_usd < 10)   -- null = not set, no euro amounts shown
);
insert into public.app_settings default values;
alter table public.app_settings enable row level security;
create policy app_settings_read on public.app_settings for select to authenticated using (is_admin());
create policy app_settings_owner on public.app_settings for update to authenticated using (is_owner()) with check (is_owner());
grant select, update on public.app_settings to authenticated;
revoke all on public.app_settings from anon;
