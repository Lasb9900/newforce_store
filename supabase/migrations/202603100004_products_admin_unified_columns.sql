-- Definitive products schema alignment for admin module + CSV import
alter table public.products
  add column if not exists item_number text,
  add column if not exists department text,
  add column if not exists item_description text,
  add column if not exists qty integer default 0,
  add column if not exists seller_category text,
  add column if not exists category text,
  add column if not exists condition text,
  add column if not exists image_url text,
  add column if not exists price_cents integer default 0,
  add column if not exists active boolean default true,
  add column if not exists featured boolean default false;

-- Ensure defaults for existing environments
alter table public.products alter column qty set default 0;
alter table public.products alter column price_cents set default 0;
alter table public.products alter column active set default true;
alter table public.products alter column featured set default false;

-- Backfill canonical fields from existing data and keep name non-null safety
update public.products
set
  item_number = coalesce(item_number, sku),
  sku = coalesce(sku, item_number),
  item_description = coalesce(item_description, nullif(name, '')),
  name = coalesce(nullif(name, ''), nullif(item_description, ''), nullif(item_number, ''), 'Producto sin nombre'),
  qty = coalesce(qty, base_stock, 0),
  base_stock = coalesce(base_stock, qty, 0),
  price_cents = coalesce(price_cents, base_price_cents, 0),
  base_price_cents = coalesce(base_price_cents, price_cents),
  condition = coalesce(condition, item_condition),
  image_url = coalesce(image_url, (
    select pi.url
    from public.product_images pi
    where pi.product_id = public.products.id
    order by pi.sort_order asc
    limit 1
  ));

-- Unique key for upsert/matching by item_number
create unique index if not exists products_item_number_idx
  on public.products(item_number);

-- Replace old compatibility triggers that depended on item_condition
DROP TRIGGER IF EXISTS trg_products_sync_csv_compat_fields ON public.products;
DROP TRIGGER IF EXISTS trg_products_sync_module_columns ON public.products;
DROP FUNCTION IF EXISTS public.sync_products_csv_compat_fields();
DROP FUNCTION IF EXISTS public.sync_products_module_columns();

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

  new.price_cents := coalesce(new.price_cents, new.base_price_cents, 0);
  new.base_price_cents := coalesce(new.base_price_cents, new.price_cents);

  new.condition := coalesce(nullif(new.condition, ''), '');

  return new;
end;
$$;

create trigger trg_products_sync_admin_columns
before insert or update on public.products
for each row execute function public.sync_products_admin_columns();

notify pgrst, 'reload schema';
