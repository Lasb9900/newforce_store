-- Ensure products supports CSV import fields and legacy/new naming compatibility
alter table products
  add column if not exists item_number text,
  add column if not exists department text,
  add column if not exists item_description text,
  add column if not exists seller_category text,
  add column if not exists item_condition text,
  add column if not exists "condition" text,
  add column if not exists qty integer;

-- Backfill compatibility fields from existing data when possible
update products
set
  item_number = coalesce(item_number, sku),
  sku = coalesce(sku, item_number),
  qty = coalesce(qty, base_stock),
  base_stock = coalesce(base_stock, qty, 0),
  "condition" = coalesce("condition", item_condition),
  item_condition = coalesce(item_condition, "condition")
where true;

-- Keep legacy/new fields synchronized for CRUD/import paths
create or replace function sync_products_csv_compat_fields() returns trigger
language plpgsql
as $$
begin
  new.sku := coalesce(nullif(new.sku, ''), nullif(new.item_number, ''));
  new.item_number := coalesce(nullif(new.item_number, ''), nullif(new.sku, ''));

  new.base_stock := coalesce(new.base_stock, new.qty, 0);
  new.qty := coalesce(new.qty, new.base_stock, 0);

  new.item_condition := coalesce(nullif(new.item_condition, ''), nullif(new."condition", ''));
  new."condition" := coalesce(nullif(new."condition", ''), nullif(new.item_condition, ''));

  return new;
end;
$$;

drop trigger if exists trg_products_sync_csv_compat_fields on products;
create trigger trg_products_sync_csv_compat_fields
before insert or update on products
for each row execute function sync_products_csv_compat_fields();

create index if not exists idx_products_item_number on products (item_number);
create index if not exists idx_products_qty on products (qty);

-- Refresh PostgREST schema cache in Supabase environments
notify pgrst, 'reload schema';
