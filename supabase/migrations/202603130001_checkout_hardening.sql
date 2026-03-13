alter table public.products add column if not exists price_cents int;
alter table public.products add column if not exists stock int;

update public.products
set
  price_cents = coalesce(price_cents, base_price_cents),
  stock = coalesce(stock, base_stock)
where price_cents is null or stock is null;

alter table public.orders add column if not exists email text;
alter table public.orders add column if not exists full_name text;
alter table public.orders add column if not exists phone text;
alter table public.orders add column if not exists shipping_cents int not null default 0;
alter table public.orders add column if not exists tax_cents int not null default 0;
alter table public.orders add column if not exists payment_status text not null default 'pending';
alter table public.orders add column if not exists shipping_address_line_1 text;
alter table public.orders add column if not exists shipping_city text;
alter table public.orders add column if not exists shipping_state text;
alter table public.orders add column if not exists shipping_postal_code text;
alter table public.orders add column if not exists shipping_country text;
alter table public.orders add column if not exists paid_at timestamptz;

alter table public.order_items add column if not exists quantity int;
alter table public.order_items add column if not exists unit_price_cents int;
alter table public.order_items add column if not exists line_total_cents int;
alter table public.order_items add column if not exists product_name_snapshot text;

update public.order_items
set
  quantity = coalesce(quantity, qty),
  unit_price_cents = coalesce(unit_price_cents, unit_price_cents_snapshot),
  product_name_snapshot = coalesce(product_name_snapshot, name_snapshot),
  line_total_cents = coalesce(line_total_cents, qty * unit_price_cents_snapshot)
where quantity is null
   or unit_price_cents is null
   or product_name_snapshot is null
   or line_total_cents is null;

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_events_order_created on public.order_events(order_id, created_at);
