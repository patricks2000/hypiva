-- Campaign requests: budget is now a range from a dropdown (optional), plus the currency the visitor chose.
alter table public.brand_leads
  add column currency text not null default 'USD' check (currency in ('USD', 'EUR'));
alter table public.brand_leads
  add constraint brand_leads_budget_range check (budget in ('', 'under_500', '500_2000', '2000_5000', '5000_plus', 'not_sure')) not valid;
