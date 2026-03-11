-- Align admin reporting so POS sales are always included in sales and top-products widgets.

create or replace view public.admin_top_products as
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
group by oi.product_id;

notify pgrst, 'reload schema';
