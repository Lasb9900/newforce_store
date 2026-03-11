-- Unify POS reporting source so admin pages don't depend solely on pos_sales table.

create or replace view public.pos_sales_report as
with order_backed as (
  select
    oi.id as row_id,
    o.id as order_id,
    oi.created_at,
    oi.product_id,
    oi.name_snapshot as product_name,
    p.item_number,
    oi.qty,
    oi.unit_price_cents_snapshot as price,
    oi.line_total_cents as total,
    o.payment_method,
    o.payment_reference,
    o.buyer_email as customer_email,
    o.sold_by as created_by
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  left join public.products p on p.id = oi.product_id
  where o.channel = 'physical_store'
    and o.status = 'paid'
    and o.payment_status = 'paid'
),
pos_table_only as (
  select
    ps.id as row_id,
    ps.order_id,
    ps.created_at,
    ps.product_id,
    ps.product_name,
    ps.item_number,
    ps.qty,
    ps.price,
    ps.total,
    ps.payment_method,
    ps.payment_reference,
    ps.customer_email,
    ps.created_by
  from public.pos_sales ps
  left join public.order_items oi
    on oi.order_id = ps.order_id
   and oi.product_id = ps.product_id
   and oi.created_at = ps.created_at
  where oi.id is null
)
select * from order_backed
union all
select * from pos_table_only;

create or replace view public.admin_top_products as
with from_orders as (
  select
    oi.product_id,
    max(oi.name_snapshot) as product_name,
    sum(oi.qty)::bigint as units_sold,
    sum(oi.line_total_cents)::bigint as revenue_cents,
    sum(oi.qty) filter (where o.channel = 'online')::bigint as online_units,
    sum(oi.qty) filter (where o.channel = 'physical_store')::bigint as physical_units
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status = 'paid'
    and o.payment_status = 'paid'
  group by oi.product_id
),
from_pos_without_items as (
  select
    ps.product_id,
    max(ps.product_name) as product_name,
    sum(ps.qty)::bigint as units_sold,
    sum(ps.total)::bigint as revenue_cents,
    0::bigint as online_units,
    sum(ps.qty)::bigint as physical_units
  from public.pos_sales ps
  left join public.order_items oi
    on oi.order_id = ps.order_id
   and oi.product_id = ps.product_id
   and oi.created_at = ps.created_at
  where oi.id is null
  group by ps.product_id
)
select
  merged.product_id,
  max(merged.product_name) as product_name,
  sum(merged.units_sold)::bigint as units_sold,
  sum(merged.revenue_cents)::bigint as revenue_cents,
  sum(merged.online_units)::bigint as online_units,
  sum(merged.physical_units)::bigint as physical_units
from (
  select * from from_orders
  union all
  select * from from_pos_without_items
) merged
group by merged.product_id;

create or replace view public.admin_sales_kpis as
with online as (
  select
    coalesce(sum(total_cents), 0)::bigint as revenue_cents,
    count(*)::bigint as orders
  from public.orders
  where status = 'paid'
    and payment_status = 'paid'
    and channel = 'online'
),
physical as (
  select
    coalesce(sum(total), 0)::bigint as revenue_cents,
    count(distinct coalesce(order_id::text, row_id::text))::bigint as orders
  from public.pos_sales_report
)
select
  (online.revenue_cents + physical.revenue_cents)::bigint as total_revenue_cents,
  online.revenue_cents as online_revenue_cents,
  physical.revenue_cents as physical_revenue_cents,
  online.orders as online_orders,
  physical.orders as physical_orders,
  (online.orders + physical.orders)::bigint as paid_orders
from online cross join physical;

notify pgrst, 'reload schema';
