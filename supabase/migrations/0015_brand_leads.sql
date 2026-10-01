-- Campaign requests from the homepage form. Only the edge function "brand-lead" writes (service key);
-- only admins read. Visitors never get direct access.
create table public.brand_leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 100),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 200),
  company     text not null default '' check (length(company) <= 120),
  budget      text not null default '' check (length(budget) <= 60),
  message     text not null default '' check (length(message) <= 2000),
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.brand_leads enable row level security;
create policy brand_leads_admin_read on public.brand_leads for select to authenticated using (is_admin());
create policy brand_leads_admin_update on public.brand_leads for update to authenticated using (is_admin()) with check (is_admin());
create policy brand_leads_admin_delete on public.brand_leads for delete to authenticated using (is_admin());
grant select, update, delete on public.brand_leads to authenticated;
revoke all on public.brand_leads from anon;
