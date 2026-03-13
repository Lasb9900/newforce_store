-- Persist customer linkage + loyalty processing trace directly on POS sales.

alter table public.pos_sales
  add column if not exists customer_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists loyalty_status text null check (
    loyalty_status in ('pending', 'applied', 'duplicate', 'skipped_no_user', 'skipped_no_email', 'skipped_ineligible', 'error')
  ),
  add column if not exists loyalty_points_awarded int not null default 0,
  add column if not exists loyalty_processed_at timestamptz null,
  add column if not exists loyalty_error text null;

create index if not exists pos_sales_customer_user_id_idx
  on public.pos_sales(customer_user_id);

create index if not exists pos_sales_loyalty_status_idx
  on public.pos_sales(loyalty_status);

-- Keep create_pos_sale compatible, but guarantee user_id linkage when p_customer_id is passed.
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
    raise exception using errcode = 'P0001', message = 'INVALID_QTY';
  end if;

  if p_payment_method not in ('cash','card','transfer') then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_METHOD';
  end if;

  v_ref := nullif(trim(coalesce(p_payment_reference, '')), '');
  if p_payment_method in ('card','transfer') and v_ref is null then
    raise exception using errcode = 'P0001', message = 'PAYMENT_REFERENCE_REQUIRED';
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
    raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_FOUND';
  end if;

  if not v_product.active then
    raise exception using errcode = 'P0001', message = 'PRODUCT_INACTIVE';
  end if;

  v_price := v_product.price_cents;
  v_stock := coalesce(v_product.stock, 0);

  if v_price is null or v_price <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_PRICE';
  end if;

  if v_stock < p_qty then
    raise exception using errcode = 'P0001', message = 'STOCK_INSUFFICIENT';
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
    raise exception using errcode = 'P0001', message = 'INVENTORY_UPDATE_FAILED';
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
    customer_user_id,
    created_by,
    loyalty_status,
    loyalty_points_awarded
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
    p_customer_id,
    p_sold_by,
    'pending',
    0
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
