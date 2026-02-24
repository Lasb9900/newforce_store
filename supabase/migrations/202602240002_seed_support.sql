alter table profiles add column if not exists username text;

create unique index if not exists idx_products_sku_unique
  on products (sku)
  where sku is not null;

create unique index if not exists idx_product_variants_sku_unique
  on product_variants (sku)
  where sku is not null;
