-- Align runtime POS closure schema with API payload to avoid column-by-column failures.

create table if not exists public.pos_cash_closures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.pos_cash_closures
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references auth.users(id),
  add column if not exists from_date timestamptz,
  add column if not exists to_date timestamptz,
  add column if not exists expected_cash int,
  add column if not exists expected_card int,
  add column if not exists expected_transfer int,
  add column if not exists actual_cash int,
  add column if not exists actual_card int,
  add column if not exists actual_transfer int,
  add column if not exists cash_difference int,
  add column if not exists card_difference int,
  add column if not exists transfer_difference int,
  add column if not exists notes text,
  add column if not exists status text;

update public.pos_cash_closures
set
  closed_at = coalesce(closed_at, created_at, now()),
  expected_cash = coalesce(expected_cash, 0),
  expected_card = coalesce(expected_card, 0),
  expected_transfer = coalesce(expected_transfer, 0),
  actual_cash = coalesce(actual_cash, 0),
  actual_card = coalesce(actual_card, 0),
  actual_transfer = coalesce(actual_transfer, 0),
  cash_difference = coalesce(cash_difference, 0),
  card_difference = coalesce(card_difference, 0),
  transfer_difference = coalesce(transfer_difference, 0),
  status = coalesce(status, 'closed')
where
  closed_at is null
  or expected_cash is null
  or expected_card is null
  or expected_transfer is null
  or actual_cash is null
  or actual_card is null
  or actual_transfer is null
  or cash_difference is null
  or card_difference is null
  or transfer_difference is null
  or status is null;

alter table public.pos_cash_closures
  alter column closed_at set default now(),
  alter column expected_cash set default 0,
  alter column expected_card set default 0,
  alter column expected_transfer set default 0,
  alter column actual_cash set default 0,
  alter column actual_card set default 0,
  alter column actual_transfer set default 0,
  alter column cash_difference set default 0,
  alter column card_difference set default 0,
  alter column transfer_difference set default 0,
  alter column status set default 'closed';

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
