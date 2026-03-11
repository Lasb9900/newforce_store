-- Ensure POS cash closure tables exist in environments where prior migration wasn't applied.

create table if not exists public.pos_cash_closures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  closed_at timestamptz not null default now(),
  closed_by uuid not null references auth.users(id),
  from_date timestamptz not null,
  to_date timestamptz not null,
  expected_cash int not null default 0,
  expected_card int not null default 0,
  expected_transfer int not null default 0,
  actual_cash int not null default 0,
  actual_card int not null default 0,
  actual_transfer int not null default 0,
  cash_difference int not null default 0,
  card_difference int not null default 0,
  transfer_difference int not null default 0,
  notes text,
  status text not null default 'closed' check (status in ('closed','cancelled')),
  constraint pos_cash_closures_range_check check (to_date >= from_date)
);

create table if not exists public.pos_cash_closure_sales (
  id uuid primary key default gen_random_uuid(),
  closure_id uuid not null references public.pos_cash_closures(id) on delete cascade,
  sale_order_id uuid not null references public.orders(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (closure_id, sale_order_id)
);

create index if not exists idx_pos_cash_closures_period on public.pos_cash_closures(from_date, to_date);
create unique index if not exists idx_pos_cash_closures_period_unique_closed
  on public.pos_cash_closures(from_date, to_date)
  where status = 'closed';
create index if not exists idx_pos_cash_closure_sales_closure on public.pos_cash_closure_sales(closure_id);
create index if not exists idx_pos_cash_closure_sales_order on public.pos_cash_closure_sales(sale_order_id);

alter table public.pos_cash_closures enable row level security;
alter table public.pos_cash_closure_sales enable row level security;

drop policy if exists pos_cash_closures_select_staff on public.pos_cash_closures;
create policy pos_cash_closures_select_staff
on public.pos_cash_closures
for select
using (is_seller());

drop policy if exists pos_cash_closures_insert_staff on public.pos_cash_closures;
create policy pos_cash_closures_insert_staff
on public.pos_cash_closures
for insert
with check (is_seller());

drop policy if exists pos_cash_closures_update_admin on public.pos_cash_closures;
create policy pos_cash_closures_update_admin
on public.pos_cash_closures
for update
using (is_admin())
with check (is_admin());

drop policy if exists pos_cash_closure_sales_select_staff on public.pos_cash_closure_sales;
create policy pos_cash_closure_sales_select_staff
on public.pos_cash_closure_sales
for select
using (is_seller());

drop policy if exists pos_cash_closure_sales_insert_staff on public.pos_cash_closure_sales;
create policy pos_cash_closure_sales_insert_staff
on public.pos_cash_closure_sales
for insert
with check (is_seller());

notify pgrst, 'reload schema';
