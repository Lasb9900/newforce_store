-- Corrective hardening for POS loyalty/account linkage columns without coupling to orders.

alter table public.pos_sales
  add column if not exists cash_closure_id uuid null,
  add column if not exists customer_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists loyalty_status text null,
  add column if not exists loyalty_points_awarded integer not null default 0,
  add column if not exists loyalty_error text null;

create index if not exists pos_sales_customer_user_id_idx on public.pos_sales(customer_user_id);
create index if not exists pos_sales_customer_email_idx on public.pos_sales(customer_email);
create index if not exists pos_sales_created_at_idx on public.pos_sales(created_at);

alter table public.pos_sales
  drop constraint if exists pos_sales_loyalty_status_check;

alter table public.pos_sales
  add constraint pos_sales_loyalty_status_check
  check (loyalty_status is null or loyalty_status in ('pending', 'applied', 'duplicate', 'skipped_no_user', 'skipped_no_email', 'skipped_ineligible', 'error'));
