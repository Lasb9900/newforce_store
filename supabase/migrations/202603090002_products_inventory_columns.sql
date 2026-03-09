-- Inventory import fields from CSV feeds
alter table products
  add column if not exists department text,
  add column if not exists item_description text,
  add column if not exists seller_category text,
  add column if not exists item_condition text;

create index if not exists idx_products_department on products (department);
create index if not exists idx_products_seller_category on products (seller_category);
create index if not exists idx_products_item_condition on products (item_condition);
