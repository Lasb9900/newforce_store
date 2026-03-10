-- Final guard migration: ensure products has all admin inventory columns
alter table products
  add column if not exists item_number text,
  add column if not exists department text,
  add column if not exists item_description text,
  add column if not exists qty integer default 0,
  add column if not exists seller_category text,
  add column if not exists category text,
  add column if not exists "condition" text,
  add column if not exists image_url text,
  add column if not exists price_cents integer default 0,
  add column if not exists active boolean default true,
  add column if not exists featured boolean default false;

-- Keep compatibility with previous canonical columns
update products
set
  item_number = coalesce(item_number, sku),
  sku = coalesce(sku, item_number),
  qty = coalesce(qty, base_stock, 0),
  base_stock = coalesce(base_stock, qty, 0),
  item_description = coalesce(item_description, name),
  name = coalesce(name, item_description),
  price_cents = coalesce(price_cents, base_price_cents, 0),
  base_price_cents = coalesce(base_price_cents, price_cents),
  "condition" = coalesce("condition", item_condition),
  item_condition = coalesce(item_condition, "condition")
where true;

create unique index if not exists products_item_number_idx
  on products (item_number)
  where item_number is not null;

notify pgrst, 'reload schema';
