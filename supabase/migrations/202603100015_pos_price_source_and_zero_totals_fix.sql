-- Fix effective product price source for POS and repair zeroed POS monetary data.

-- 1) Normalize product price columns so legacy rows with price_cents=0 and base_price_cents>0
-- don't force POS sales to zero.
update public.products
set
  price_cents = case
    when coalesce(price_cents, 0) <= 0 and coalesce(base_price_cents, 0) > 0 then base_price_cents
    else price_cents
  end,
  base_price_cents = case
    when coalesce(base_price_cents, 0) <= 0 and coalesce(price_cents, 0) > 0 then price_cents
    else base_price_cents
  end;

create or replace function public.sync_products_admin_columns() returns trigger
language plpgsql
as $$
begin
  new.sku := coalesce(nullif(new.sku, ''), nullif(new.item_number, ''));
  new.item_number := coalesce(nullif(new.item_number, ''), nullif(new.sku, ''));

  new.name := coalesce(nullif(new.name, ''), nullif(new.item_description, ''), nullif(new.item_number, ''), 'Producto sin nombre');
  new.item_description := coalesce(nullif(new.item_description, ''), nullif(new.name, ''));

  new.qty := coalesce(new.qty, new.base_stock, 0);
  new.base_stock := coalesce(new.base_stock, new.qty, 0);

  -- Treat 0 as non-canonical fallback value for POS pricing source.
  new.price_cents := coalesce(nullif(new.price_cents, 0), nullif(new.base_price_cents, 0), 0);
  new.base_price_cents := coalesce(nullif(new.base_price_cents, 0), nullif(new.price_cents, 0), 0);

  new.condition := coalesce(nullif(new.condition, ''), '');

  return new;
end;
$$;

-- 2) Make POS RPC use effective non-zero price and reject non-positive prices.
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
  v_stock_rows int;
  v_detail text;
  v_hint text;
  v_ctx text;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_QTY',
      detail = format('qty=%s', coalesce(p_qty::text, 'null')),
      hint = 'La cantidad debe ser un entero mayor a 0';
  end if;

  if p_payment_method not in ('cash','card','transfer') then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_PAYMENT_METHOD',
      detail = format('payment_method=%s', coalesce(p_payment_method, 'null')),
      hint = 'Use cash, card o transfer';
  end if;

  v_ref := nullif(trim(coalesce(p_payment_reference, '')), '');
  if p_payment_method in ('card','transfer') and v_ref is null then
    raise exception using
      errcode = 'P0001',
      message = 'PAYMENT_REFERENCE_REQUIRED',
      detail = format('payment_method=%s', p_payment_method),
      hint = 'Debe enviar payment_reference para tarjeta o transferencia';
  end if;

  select
    id,
    name,
    item_number,
    active,
    coalesce(nullif(price_cents, 0), nullif(base_price_cents, 0), 0) as price_cents,
    coalesce(least(qty, base_stock), qty, base_stock, 0) as stock,
    qty,
    base_stock
  into v_product
  from products
  where id = p_product_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PRODUCT_NOT_FOUND',
      detail = format('product_id=%s', p_product_id::text),
      hint = 'Verifique que el producto exista';
  end if;

  if not v_product.active then
    raise exception using
      errcode = 'P0001',
      message = 'PRODUCT_INACTIVE',
      detail = format('product_id=%s', p_product_id::text),
      hint = 'Active el producto antes de venderlo';
  end if;

  v_price := v_product.price_cents;
  v_stock := coalesce(v_product.stock, 0);

  if v_price is null or v_price <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_PRICE',
      detail = format('product_id=%s price=%s', p_product_id::text, coalesce(v_price::text, 'null')),
      hint = 'El producto debe tener precio mayor a 0';
  end if;

  if v_stock < p_qty then
    raise exception using
      errcode = 'P0001',
      message = 'STOCK_INSUFFICIENT',
      detail = format('product_id=%s requested=%s available=%s qty=%s base_stock=%s', p_product_id::text, p_qty, v_stock, coalesce(v_product.qty::text,'null'), coalesce(v_product.base_stock::text,'null')),
      hint = 'Actualice inventario o reduzca la cantidad';
  end if;

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

  if v_order_id is null then
    raise exception using errcode = 'P0001', message = 'SALE_INSERT_FAILED', detail = 'orders insert returned null id';
  end if;

  insert into order_items (order_id, product_id, name_snapshot, unit_price_cents_snapshot, qty)
  values (v_order_id, v_product.id, v_product.name, v_price, p_qty);

  update products
  set qty = v_stock - p_qty,
      base_stock = v_stock - p_qty,
      updated_at = now()
  where id = p_product_id
    and coalesce(least(qty, base_stock), qty, base_stock, 0) >= p_qty;

  get diagnostics v_stock_rows = row_count;
  if v_stock_rows = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'INVENTORY_UPDATE_FAILED',
      detail = format('product_id=%s requested=%s', p_product_id::text, p_qty),
      hint = 'Reintente la operación, otro proceso pudo consumir stock';
  end if;

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

exception
  when others then
    get stacked diagnostics
      v_detail = pg_exception_detail,
      v_hint = pg_exception_hint,
      v_ctx = pg_exception_context;

    if sqlstate = 'P0001' then
      raise;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'INTERNAL_POS_SALE_ERROR',
      detail = format('sqlstate=%s sqlerrm=%s detail=%s context=%s', sqlstate, sqlerrm, coalesce(v_detail, ''), coalesce(v_ctx, '')),
      hint = coalesce(v_hint, 'Revise constraints/FK/RLS y logs de la función');
end;
$$;

grant execute on function public.create_pos_sale(uuid, int, text, text, text, uuid, uuid)
  to authenticated, service_role;

-- 3) Repair already-created physical-store sales with zeroed prices/totals where we can infer price.
with fixed_items as (
  select
    oi.id as order_item_id,
    oi.order_id,
    oi.qty,
    coalesce(nullif(oi.unit_price_cents_snapshot, 0), nullif(p.price_cents, 0), nullif(p.base_price_cents, 0), 0) as effective_unit_price
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.products p on p.id = oi.product_id
  where o.channel = 'physical_store'
    and o.status = 'paid'
    and o.payment_status = 'paid'
    and (coalesce(oi.unit_price_cents_snapshot, 0) = 0 or coalesce(o.total_cents, 0) = 0)
),
updated_items as (
  update public.order_items oi
  set unit_price_cents_snapshot = fi.effective_unit_price
  from fixed_items fi
  where oi.id = fi.order_item_id
    and fi.effective_unit_price > 0
    and coalesce(oi.unit_price_cents_snapshot, 0) = 0
  returning oi.order_id
),
recomputed_order_totals as (
  select
    oi.order_id,
    sum(oi.unit_price_cents_snapshot * oi.qty)::int as computed_total_cents
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.channel = 'physical_store'
    and o.status = 'paid'
    and o.payment_status = 'paid'
  group by oi.order_id
)
update public.orders o
set
  subtotal_cents = rot.computed_total_cents,
  total_cents = rot.computed_total_cents
from recomputed_order_totals rot
where o.id = rot.order_id
  and o.channel = 'physical_store'
  and o.status = 'paid'
  and o.payment_status = 'paid'
  and rot.computed_total_cents > 0
  and (coalesce(o.total_cents, 0) = 0 or coalesce(o.subtotal_cents, 0) = 0);

update public.pos_sales ps
set
  price = oi.unit_price_cents_snapshot,
  total = oi.line_total_cents
from public.order_items oi
join public.orders o on o.id = oi.order_id
where ps.order_id = oi.order_id
  and o.channel = 'physical_store'
  and o.status = 'paid'
  and o.payment_status = 'paid'
  and (coalesce(ps.price, 0) = 0 or coalesce(ps.total, 0) = 0)
  and coalesce(oi.unit_price_cents_snapshot, 0) > 0;

notify pgrst, 'reload schema';
