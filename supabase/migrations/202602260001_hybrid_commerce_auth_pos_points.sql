-- Hybrid commerce extension: roles, customer profiles, POS, points and analytics

alter table profiles
  add column if not exists email text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz default now();

update profiles
set role = 'admin'
where role = 'owner';

alter table profiles
  add constraint profiles_role_check check (role in ('admin','seller','customer'));

create unique index if not exists idx_profiles_email_lower on profiles (lower(email));
create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();

alter table products
  add column if not exists redeemable boolean not null default false,
  add column if not exists points_price int null;

alter table products
  add constraint products_points_price_nonnegative check (points_price is null or points_price >= 0);

alter table orders
  add column if not exists sold_by uuid null references auth.users(id),
  add column if not exists channel text not null default 'online',
  add column if not exists payment_method text,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists points_earned int not null default 0,
  add column if not exists points_redeemed int not null default 0,
  add column if not exists updated_at timestamptz default now();

alter table orders
  add constraint orders_channel_check check (channel in ('online','physical_store')),
  add constraint orders_payment_status_check check (payment_status in ('pending','paid','failed','refunded','cancelled')),
  add constraint orders_points_nonnegative check (points_earned >= 0 and points_redeemed >= 0);

create trigger trg_orders_updated before update on orders for each row execute function set_updated_at();

alter table order_items
  add column if not exists line_total_cents int generated always as (unit_price_cents_snapshot * qty) stored,
  add column if not exists points_price_snapshot int null,
  add column if not exists category_snapshot text null;

create table if not exists customer_points (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint customer_points_nonnegative check (balance >= 0)
);

create trigger trg_customer_points_updated before update on customer_points for each row execute function set_updated_at();

create table if not exists points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid null references orders(id) on delete set null,
  type text not null check (type in ('earn','redeem','adjust')),
  points_delta int not null,
  description text,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create unique index if not exists idx_points_ledger_order_earn_unique on points_ledger(order_id, type) where type = 'earn' and order_id is not null;
create index if not exists idx_points_ledger_user_created on points_ledger(user_id, created_at desc);
create index if not exists idx_orders_channel_created on orders(channel, created_at desc);
create index if not exists idx_orders_user_created on orders(user_id, created_at desc);
create index if not exists idx_order_items_order on order_items(order_id);

create or replace function is_admin() returns boolean language sql stable as $$
  select exists(select 1 from profiles where user_id = auth.uid() and role = 'admin' and is_active = true);
$$;

create or replace function is_seller() returns boolean language sql stable as $$
  select exists(select 1 from profiles where user_id = auth.uid() and role in ('admin','seller') and is_active = true);
$$;

create or replace function is_owner() returns boolean language sql stable as $$
  select is_admin();
$$;

create or replace function create_profile_for_user(
  p_user_id uuid,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_role text default 'customer'
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (user_id, role, email, first_name, last_name, phone)
  values (p_user_id, p_role, p_email, p_first_name, p_last_name, p_phone)
  on conflict (user_id)
  do update set
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    role = case when profiles.role = 'admin' then profiles.role else excluded.role end,
    updated_at = now();

  insert into customer_points (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
end;
$$;

grant execute on function create_profile_for_user(uuid, text, text, text, text, text) to authenticated, service_role;

create or replace function add_points(
  p_user_id uuid,
  p_points int,
  p_order_id uuid,
  p_description text,
  p_created_by uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_points <= 0 then
    return;
  end if;

  insert into points_ledger (user_id, order_id, type, points_delta, description, created_by)
  values (p_user_id, p_order_id, 'earn', p_points, p_description, p_created_by)
  on conflict (order_id, type) where (type = 'earn' and order_id is not null) do nothing;

  if found then
    insert into customer_points (user_id, balance)
    values (p_user_id, p_points)
    on conflict (user_id)
    do update set balance = customer_points.balance + excluded.balance, updated_at = now();
  end if;
end;
$$;

create or replace function redeem_points_for_order(
  p_user_id uuid,
  p_points int,
  p_order_id uuid,
  p_description text,
  p_created_by uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  if p_points <= 0 then
    raise exception 'Points must be positive';
  end if;

  select balance into v_balance
  from customer_points
  where user_id = p_user_id
  for update;

  if v_balance is null then
    raise exception 'Customer points account not found';
  end if;

  if v_balance < p_points then
    raise exception 'Insufficient points';
  end if;

  update customer_points
  set balance = balance - p_points,
      updated_at = now()
  where user_id = p_user_id;

  insert into points_ledger (user_id, order_id, type, points_delta, description, created_by)
  values (p_user_id, p_order_id, 'redeem', -p_points, p_description, p_created_by);
end;
$$;

grant execute on function add_points(uuid, int, uuid, text, uuid) to authenticated, service_role;
grant execute on function redeem_points_for_order(uuid, int, uuid, text, uuid) to authenticated, service_role;

create or replace view admin_sales_kpis as
select
  coalesce(sum(total_cents) filter (where status = 'paid' and payment_status = 'paid'), 0) as total_revenue_cents,
  coalesce(sum(total_cents) filter (where status = 'paid' and payment_status = 'paid' and channel = 'online'), 0) as online_revenue_cents,
  coalesce(sum(total_cents) filter (where status = 'paid' and payment_status = 'paid' and channel = 'physical_store'), 0) as physical_revenue_cents,
  count(*) filter (where status = 'paid' and payment_status = 'paid' and channel = 'online') as online_orders,
  count(*) filter (where status = 'paid' and payment_status = 'paid' and channel = 'physical_store') as physical_orders,
  count(*) filter (where status = 'paid' and payment_status = 'paid') as paid_orders
from orders;

alter table profiles enable row level security;
alter table customer_points enable row level security;
alter table points_ledger enable row level security;

drop policy if exists profiles_self_select on profiles;
create policy profiles_self_select on profiles for select using (auth.uid() = user_id or is_admin());
create policy profiles_self_update on profiles for update using (auth.uid() = user_id or is_admin()) with check (auth.uid() = user_id or is_admin());
create policy profiles_admin_insert on profiles for insert with check (is_admin());

create policy customer_points_select on customer_points for select using (auth.uid() = user_id or is_admin() or is_seller());
create policy customer_points_update_admin on customer_points for update using (is_admin()) with check (is_admin());

create policy points_ledger_select on points_ledger for select using (auth.uid() = user_id or is_admin() or is_seller());
create policy points_ledger_insert_staff on points_ledger for insert with check (is_admin() or is_seller());

drop policy if exists owner_orders_select on orders;
create policy orders_select_scoped on orders for select using (
  is_admin()
  or auth.uid() = user_id
  or (is_seller() and channel = 'physical_store')
);

create policy orders_insert_staff on orders for insert with check (is_admin() or is_seller());
create policy orders_update_staff on orders for update using (is_admin() or is_seller()) with check (is_admin() or is_seller());

drop policy if exists owner_order_items_select on order_items;
create policy order_items_select_scoped on order_items for select using (
  is_admin() or exists (
    select 1 from orders o
    where o.id = order_items.order_id
      and (o.user_id = auth.uid() or (is_seller() and o.channel = 'physical_store'))
  )
);

create policy order_items_insert_staff on order_items for insert with check (
  is_admin() or exists (
    select 1 from orders o
    where o.id = order_items.order_id and o.channel = 'physical_store' and is_seller()
  )
);
