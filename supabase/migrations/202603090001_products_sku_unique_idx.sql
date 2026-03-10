-- Prevent uncontrolled duplicates for SKU-driven imports/updates.
create unique index if not exists idx_products_sku_unique_nonnull
  on products (lower(sku))
  where sku is not null;
