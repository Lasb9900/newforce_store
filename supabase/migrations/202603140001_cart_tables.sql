create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  line_key text not null,
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid null references product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0),
  price_snapshot_cents int null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cart_id, line_key)
);

create index if not exists idx_carts_user_id on carts(user_id);
create index if not exists idx_cart_items_cart_id on cart_items(cart_id);

create trigger trg_carts_updated before update on carts for each row execute function set_updated_at();
create trigger trg_cart_items_updated before update on cart_items for each row execute function set_updated_at();

alter table carts enable row level security;
alter table cart_items enable row level security;

create policy carts_own on carts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy cart_items_own on cart_items for all using (
  exists(select 1 from carts c where c.id = cart_items.cart_id and c.user_id = auth.uid())
) with check (
  exists(select 1 from carts c where c.id = cart_items.cart_id and c.user_id = auth.uid())
);
