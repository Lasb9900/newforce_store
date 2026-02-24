create extension if not exists "pgcrypto";

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer',
  created_at timestamptz default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  currency text not null default 'USD',
  base_price_cents int null,
  base_stock int not null default 0,
  has_variants boolean not null default false,
  active boolean not null default true,
  featured boolean not null default false,
  featured_rank int not null default 0,
  category_id uuid references categories(id),
  tags text[] not null default '{}',
  sku text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  variant_name text not null,
  attributes jsonb not null default '{}',
  price_cents int not null,
  stock int not null default 0,
  sku text,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  url text not null,
  sort_order int not null default 0
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id),
  buyer_email text null,
  buyer_name text null,
  buyer_phone text null,
  status text check (status in ('pending','paid','failed','refunded')) default 'pending',
  subtotal_cents int not null,
  total_cents int not null,
  currency text not null default 'USD',
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  shipping_address jsonb null,
  created_at timestamptz default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  variant_id uuid null references product_variants(id),
  name_snapshot text not null,
  variant_snapshot text null,
  unit_price_cents_snapshot int not null,
  qty int not null,
  created_at timestamptz default now()
);

create table if not exists wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid references wishlists(id) on delete cascade,
  product_id uuid references products(id),
  created_at timestamptz default now(),
  unique(wishlist_id, product_id)
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  user_id uuid references auth.users(id),
  rating int check (rating between 1 and 5),
  comment text,
  status text check (status in ('visible','hidden','pending')) default 'visible',
  created_at timestamptz default now(),
  unique(product_id, user_id)
);

create index if not exists idx_products_active_featured on products(active, featured, featured_rank);
create index if not exists idx_variants_product_active on product_variants(product_id, active);
create index if not exists idx_orders_created_status on orders(created_at, status);
create index if not exists idx_order_items_product on order_items(product_id);
create index if not exists idx_reviews_product_status on reviews(product_id, status);

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_products_updated before update on products for each row execute function set_updated_at();
create trigger trg_variants_updated before update on product_variants for each row execute function set_updated_at();

create or replace function is_owner() returns boolean language sql stable as $$
  select exists(select 1 from profiles where user_id = auth.uid() and role = 'owner');
$$;

create or replace function decrement_variant_stock(variant_id uuid, qty int) returns void language plpgsql as $$
begin
  update product_variants set stock = stock - qty where id = variant_id and stock >= qty;
end $$;
create or replace function decrement_product_stock(product_id uuid, qty int) returns void language plpgsql as $$
begin
  update products set base_stock = base_stock - qty where id = product_id and base_stock >= qty;
end $$;

alter table profiles enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_images enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table wishlists enable row level security;
alter table wishlist_items enable row level security;
alter table reviews enable row level security;

create policy products_public_select on products for select using (active = true or is_owner());
create policy images_public_select on product_images for select using (exists (select 1 from products p where p.id = product_images.product_id and (p.active = true or is_owner())));
create policy variants_public_select on product_variants for select using (active = true and exists (select 1 from products p where p.id = product_variants.product_id and (p.active = true or is_owner())));
create policy reviews_visible_select on reviews for select using (status = 'visible' or is_owner());

create policy owner_products_all on products for all using (is_owner()) with check (is_owner());
create policy owner_variants_all on product_variants for all using (is_owner()) with check (is_owner());
create policy owner_images_all on product_images for all using (is_owner()) with check (is_owner());
create policy owner_categories_all on categories for all using (is_owner()) with check (is_owner());

create policy wishlist_own on wishlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy wishlist_items_own on wishlist_items for all using (exists(select 1 from wishlists w where w.id = wishlist_id and w.user_id = auth.uid())) with check (exists(select 1 from wishlists w where w.id = wishlist_id and w.user_id = auth.uid()));

create policy reviews_insert_owned_purchase on reviews for insert to authenticated with check (
  auth.uid() = user_id and exists (
    select 1 from orders o
    join order_items oi on oi.order_id = o.id
    where o.user_id = auth.uid() and o.status = 'paid' and oi.product_id = reviews.product_id
  )
);
create policy owner_reviews_update on reviews for update using (is_owner()) with check (is_owner());

create policy owner_orders_select on orders for select using (is_owner() or auth.uid() = user_id);
create policy owner_order_items_select on order_items for select using (is_owner());
