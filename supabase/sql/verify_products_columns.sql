-- Verify current products columns in connected database
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
order by ordinal_position;

-- Quick existence check for required inventory/admin columns
select c as required_column,
       exists (
         select 1
         from information_schema.columns ic
         where ic.table_schema = 'public'
           and ic.table_name = 'products'
           and ic.column_name = c
       ) as exists_in_public_products
from unnest(array[
  'item_number','department','item_description','qty','seller_category','category','condition','image_url','price_cents','active','featured'
]) as c;
