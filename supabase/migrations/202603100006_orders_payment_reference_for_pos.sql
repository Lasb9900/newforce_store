-- Store manual transaction references for POS sales (card/transfer)
alter table public.orders
  add column if not exists payment_reference text;

create index if not exists idx_orders_payment_reference
  on public.orders (payment_reference)
  where payment_reference is not null;

notify pgrst, 'reload schema';
