-- Detect historical POS inconsistencies after incidents.

-- 1) Physical-store paid orders without order_items
select o.id as order_id, o.created_at, o.sold_by, o.total_cents
from public.orders o
left join public.order_items oi on oi.order_id = o.id
where o.channel = 'physical_store'
  and o.status = 'paid'
  and o.payment_status = 'paid'
group by o.id, o.created_at, o.sold_by, o.total_cents
having count(oi.id) = 0;

-- 2) Physical-store paid order_items not represented in pos_sales
select oi.order_id, oi.product_id, oi.created_at
from public.order_items oi
join public.orders o on o.id = oi.order_id
left join public.pos_sales ps
  on ps.order_id = oi.order_id
 and ps.product_id = oi.product_id
 and ps.created_at = oi.created_at
where o.channel = 'physical_store'
  and o.status = 'paid'
  and o.payment_status = 'paid'
  and ps.id is null;

-- 3) pos_sales rows with missing linked order (if order_id was expected)
select ps.id, ps.order_id, ps.created_at, ps.product_id, ps.total
from public.pos_sales ps
left join public.orders o on o.id = ps.order_id
where ps.order_id is not null and o.id is null;

-- 4) Orders whose sum(order_items) does not match order total.
select o.id as order_id,
       o.total_cents as order_total_cents,
       coalesce(sum(oi.line_total_cents), 0) as item_total_cents
from public.orders o
left join public.order_items oi on oi.order_id = o.id
where o.channel = 'physical_store'
  and o.status = 'paid'
  and o.payment_status = 'paid'
group by o.id, o.total_cents
having coalesce(sum(oi.line_total_cents), 0) <> o.total_cents;

-- 5) Product stock column divergence (can cause UI vs RPC mismatch if not normalized)
select id, name, qty, base_stock
from public.products
where qty is distinct from base_stock;
