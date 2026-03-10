create extension if not exists pgcrypto;

-- Some environments may still have pos_sales as a view from older migration state.
drop view if exists public.pos_sales;

create table if not exists public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  order_id uuid null references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text,
  item_number text,
  qty integer not null check (qty > 0),
  price integer not null default 0,
  total integer not null default 0,
  payment_method text not null check (payment_method in ('cash','card','transfer')),
  payment_reference text,
  customer_email text,
  created_by uuid null references auth.users(id) on delete set null
);

create index if not exists pos_sales_created_at_idx
  on public.pos_sales(created_at);
create index if not exists pos_sales_product_id_idx
  on public.pos_sales(product_id);
create index if not exists pos_sales_payment_method_idx
  on public.pos_sales(payment_method);
create index if not exists pos_sales_order_id_idx
  on public.pos_sales(order_id);

alter table public.pos_sales enable row level security;

drop policy if exists pos_sales_select_staff on public.pos_sales;
create policy pos_sales_select_staff
on public.pos_sales
for select
using (is_seller());

drop policy if exists pos_sales_insert_staff on public.pos_sales;
create policy pos_sales_insert_staff
on public.pos_sales
for insert
with check (is_seller());

-- Backfill historical physical-store paid sales if any are missing in pos_sales.
insert into public.pos_sales (
  order_id,
  created_at,
  product_id,
  product_name,
  item_number,
  qty,
  price,
  total,
  payment_method,
  payment_reference,
  customer_email,
  created_by
)
select
  o.id,
  oi.created_at,
  oi.product_id,
  oi.name_snapshot,
  p.item_number,
  oi.qty,
  oi.unit_price_cents_snapshot,
  oi.line_total_cents,
  coalesce(o.payment_method, 'cash'),
  o.payment_reference,
  o.buyer_email,
  o.sold_by
from public.orders o
join public.order_items oi on oi.order_id = o.id
left join public.products p on p.id = oi.product_id
left join public.pos_sales ps
  on ps.order_id = o.id
 and ps.product_id = oi.product_id
 and ps.created_at = oi.created_at
where o.channel = 'physical_store'
  and o.status = 'paid'
  and o.payment_status = 'paid'
  and ps.id is null;

create or replace function public.create_pos_sale(
  p_product_id uuid,
  p_qty int,
  p_payment_method text,
  p_payment_reference text,
  p_customer_email text,
  p_sold_by uuid,
  p_customer_id uuid
)
returns table (
  order_id uuid,
  created_at timestamptz,
  total_cents int,
  points_earned int,
  payment_reference text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product record;
  v_price int;
  v_stock int;
  v_order_id uuid;
  v_created_at timestamptz;
  v_total int;
  v_points int;
  v_ref text;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad inválida';
  end if;

  if p_payment_method not in ('cash','card','transfer') then
    raise exception 'Método de pago inválido';
  end if;

  v_ref := nullif(trim(coalesce(p_payment_reference, '')), '');
  if p_payment_method in ('card','transfer') and v_ref is null then
    raise exception 'Referencia de pago obligatoria';
  end if;

  select
    id,
    name,
    item_number,
    active,
    coalesce(price_cents, base_price_cents) as price_cents,
    coalesce(qty, base_stock) as stock
  into v_product
  from products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Producto no encontrado';
  end if;

  if not v_product.active then
    raise exception 'Producto inactivo';
  end if;

  v_price := v_product.price_cents;
  v_stock := v_product.stock;

  if v_price is null or v_price < 0 then
    raise exception 'Precio inválido';
  end if;

  if v_stock < p_qty then
    raise exception 'Stock insuficiente. Disponible: %', v_stock;
  end if;

  update products
  set qty = v_stock - p_qty,
      base_stock = v_stock - p_qty,
      updated_at = now()
  where id = p_product_id;

  v_total := v_price * p_qty;
  v_points := case when p_customer_id is null then 0 else floor(v_total / 100.0)::int end;

  insert into orders (
    user_id, sold_by, buyer_email, status, payment_status, payment_method, payment_reference,
    subtotal_cents, total_cents, currency, channel, points_earned
  ) values (
    p_customer_id,
    p_sold_by,
    nullif(trim(coalesce(p_customer_email, '')), ''),
    'paid',
    'paid',
    p_payment_method,
    v_ref,
    v_total,
    v_total,
    'USD',
    'physical_store',
    v_points
  )
  returning id, orders.created_at into v_order_id, v_created_at;

  insert into order_items (order_id, product_id, name_snapshot, unit_price_cents_snapshot, qty)
  values (v_order_id, v_product.id, v_product.name, v_price, p_qty);

  insert into pos_sales (
    order_id,
    created_at,
    product_id,
    product_name,
    item_number,
    qty,
    price,
    total,
    payment_method,
    payment_reference,
    customer_email,
    created_by
  ) values (
    v_order_id,
    v_created_at,
    v_product.id,
    v_product.name,
    v_product.item_number,
    p_qty,
    v_price,
    v_total,
    p_payment_method,
    v_ref,
    nullif(trim(coalesce(p_customer_email, '')), ''),
    p_sold_by
  );

  return query select v_order_id, v_created_at, v_total, v_points, v_ref;
end;
$$;

grant execute on function public.create_pos_sale(uuid, int, text, text, text, uuid, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
