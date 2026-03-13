-- Cart hardening migration: idempotent trigger/index/constraint alignment for production.

create index if not exists idx_cart_items_cart_line_key on cart_items(cart_id, line_key);
create index if not exists idx_cart_items_variant_id on cart_items(variant_id) where variant_id is not null;

alter table cart_items
  alter column line_key set not null,
  alter column quantity set not null;

-- Ensure only one cart per user is enforced even in legacy environments.
create unique index if not exists uq_carts_user_id on carts(user_id);

-- Recreate triggers idempotently to avoid migration drift between environments.
drop trigger if exists trg_carts_updated on carts;
create trigger trg_carts_updated before update on carts for each row execute function set_updated_at();

drop trigger if exists trg_cart_items_updated on cart_items;
create trigger trg_cart_items_updated before update on cart_items for each row execute function set_updated_at();
