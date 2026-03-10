-- Ensure POS RPC exists with the exact argument names used by the API layer.
-- This migration hardens compatibility with PostgREST schema cache lookup.

drop function if exists public.create_pos_sale(uuid, int, text, text, text, uuid, uuid);
drop function if exists public.create_pos_sale(uuid, int, text, text, text, uuid);
drop function if exists public.create_pos_sale(uuid, int, text, text, uuid, uuid);
drop function if exists public.create_pos_sale(uuid, int, text, text, uuid);
drop function if exists public.create_pos_sale(
  p_product_id uuid,
  p_qty int,
  p_payment_method text,
  p_payment_reference text,
  p_customer_email text,
  p_sold_by uuid,
  p_customer_id uuid
);

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

  select id, name, active, coalesce(price_cents, base_price_cents) as price_cents, coalesce(qty, base_stock) as stock
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

  return query select v_order_id, v_created_at, v_total, v_points, v_ref;
end;
$$;

grant execute on function public.create_pos_sale(uuid, int, text, text, text, uuid, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
