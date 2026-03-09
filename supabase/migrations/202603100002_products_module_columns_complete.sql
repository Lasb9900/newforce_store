-- Complete products module compatibility columns for admin CRUD + CSV import
alter table products
  add column if not exists item_number text,
  add column if not exists department text,
  add column if not exists item_description text,
  add column if not exists qty integer not null default 0,
  add column if not exists seller_category text,
  add column if not exists category text,
  add column if not exists "condition" text,
  add column if not exists image_url text,
  add column if not exists price_cents integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_qty_nonnegative') then
    alter table products add constraint products_qty_nonnegative check (qty >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_price_cents_nonnegative') then
    alter table products add constraint products_price_cents_nonnegative check (price_cents is null or price_cents >= 0);
  end if;
end
$$;

-- Backfill/normalize from existing canonical fields
update products p
set
  item_number = coalesce(p.item_number, p.sku),
  sku = coalesce(p.sku, p.item_number),
  qty = coalesce(nullif(p.qty, 0), p.base_stock, 0),
  base_stock = coalesce(p.base_stock, p.qty, 0),
  price_cents = coalesce(p.price_cents, p.base_price_cents),
  base_price_cents = coalesce(p.base_price_cents, p.price_cents),
  "condition" = coalesce(p."condition", p.item_condition),
  item_condition = coalesce(p.item_condition, p."condition"),
  category = coalesce(p.category, c.name)
from categories c
where p.category_id = c.id;

update products p
set image_url = pi.url
from lateral (
  select url
  from product_images
  where product_id = p.id
  order by sort_order asc
  limit 1
) pi
where p.image_url is null;

create or replace function sync_products_module_columns() returns trigger
language plpgsql
as $$
begin
  new.sku := coalesce(nullif(new.sku, ''), nullif(new.item_number, ''));
  new.item_number := coalesce(nullif(new.item_number, ''), nullif(new.sku, ''));

  new.base_stock := coalesce(new.base_stock, new.qty, 0);
  new.qty := coalesce(new.qty, new.base_stock, 0);

  new.base_price_cents := coalesce(new.base_price_cents, new.price_cents);
  new.price_cents := coalesce(new.price_cents, new.base_price_cents);

  new.item_condition := coalesce(nullif(new.item_condition, ''), nullif(new."condition", ''));
  new."condition" := coalesce(nullif(new."condition", ''), nullif(new.item_condition, ''));

  if new.category is null and new.category_id is not null then
    select name into new.category from categories where id = new.category_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_products_sync_module_columns on products;
create trigger trg_products_sync_module_columns
before insert or update on products
for each row execute function sync_products_module_columns();

create unique index if not exists idx_products_item_number_unique_nonnull
  on products (lower(item_number))
  where item_number is not null;
create index if not exists idx_products_category_text on products (category);
create index if not exists idx_products_department_text on products (department);

notify pgrst, 'reload schema';
