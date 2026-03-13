-- Unified loyalty accrual engine for online orders and POS sales.

create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  source_type text not null check (source_type in ('online_order', 'pos_sale')),
  source_id uuid not null,
  points_delta int not null default 0,
  amount_cents int not null default 0,
  email_snapshot text null,
  status text not null check (status in ('pending', 'applied', 'duplicate', 'skipped_no_user', 'skipped_ineligible', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id)
);

create index if not exists loyalty_transactions_user_created_idx
  on public.loyalty_transactions(user_id, created_at desc);

create trigger trg_loyalty_transactions_updated
before update on public.loyalty_transactions
for each row execute function public.set_updated_at();

alter table public.loyalty_transactions enable row level security;

create policy loyalty_transactions_select_scoped
on public.loyalty_transactions
for select
using (auth.uid() = user_id or public.is_admin() or public.is_seller());

create policy loyalty_transactions_insert_staff
on public.loyalty_transactions
for insert
with check (public.is_admin() or public.is_seller());

create policy loyalty_transactions_update_staff
on public.loyalty_transactions
for update
using (public.is_admin() or public.is_seller())
with check (public.is_admin() or public.is_seller());

create or replace function public.process_loyalty_accrual(
  p_source_type text,
  p_source_id uuid,
  p_email text default null,
  p_amount_cents int default 0,
  p_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  transaction_id uuid,
  status text,
  points_awarded int,
  resolved_user_id uuid,
  normalized_email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx_id uuid;
  v_status text;
  v_points int := 0;
  v_user_id uuid := p_user_id;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_existing public.loyalty_transactions%rowtype;
begin
  if p_source_type not in ('online_order', 'pos_sale') then
    raise exception 'Invalid source type: %', p_source_type;
  end if;

  insert into public.loyalty_transactions (
    source_type,
    source_id,
    status,
    amount_cents,
    email_snapshot,
    metadata,
    user_id,
    points_delta
  )
  values (
    p_source_type,
    p_source_id,
    'pending',
    greatest(coalesce(p_amount_cents, 0), 0),
    v_email,
    coalesce(p_metadata, '{}'::jsonb),
    p_user_id,
    0
  )
  on conflict (source_type, source_id) do nothing
  returning id into v_tx_id;

  if v_tx_id is null then
    select *
      into v_existing
    from public.loyalty_transactions
    where source_type = p_source_type
      and source_id = p_source_id;

    return query
    select v_existing.id, 'duplicate'::text, 0::int, v_existing.user_id, v_existing.email_snapshot;
    return;
  end if;

  if v_user_id is null and v_email is not null then
    select p.user_id
      into v_user_id
    from public.profiles p
    where lower(trim(coalesce(p.email, ''))) = v_email
    limit 1;
  end if;

  if coalesce(p_amount_cents, 0) <= 0 then
    v_status := 'skipped_ineligible';
    v_points := 0;
  else
    v_points := floor(p_amount_cents / 100.0)::int;

    if v_points <= 0 then
      v_status := 'skipped_ineligible';
    elsif v_user_id is null then
      v_status := 'skipped_no_user';
      v_points := 0;
    else
      v_status := 'applied';
    end if;
  end if;

  if v_status = 'applied' then
    insert into public.customer_points (user_id, balance)
    values (v_user_id, v_points)
    on conflict (user_id)
    do update set
      balance = public.customer_points.balance + excluded.balance,
      updated_at = now();

    insert into public.points_ledger (user_id, order_id, type, points_delta, description)
    values (
      v_user_id,
      p_source_id,
      'earn',
      v_points,
      case
        when p_source_type = 'online_order' then format('Puntos por compra online %s', p_source_id)
        else format('Puntos por venta POS %s', p_source_id)
      end
    )
    on conflict (order_id, type) where (type = 'earn' and order_id is not null) do nothing;

    update public.orders
    set
      user_id = coalesce(public.orders.user_id, v_user_id),
      points_earned = greatest(coalesce(public.orders.points_earned, 0), v_points),
      updated_at = now()
    where id = p_source_id;
  end if;

  update public.loyalty_transactions
  set
    user_id = v_user_id,
    status = v_status,
    points_delta = case when v_status = 'applied' then v_points else 0 end,
    amount_cents = greatest(coalesce(p_amount_cents, 0), 0),
    email_snapshot = coalesce(v_email, email_snapshot),
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
    updated_at = now()
  where id = v_tx_id;

  return query
  select v_tx_id, v_status, case when v_status = 'applied' then v_points else 0 end, v_user_id, v_email;

exception
  when others then
    if v_tx_id is not null then
      update public.loyalty_transactions
      set status = 'error',
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('error', sqlerrm),
          updated_at = now()
      where id = v_tx_id;
    end if;

    raise;
end;
$$;

grant execute on function public.process_loyalty_accrual(text, uuid, text, int, uuid, jsonb)
  to authenticated, service_role;
