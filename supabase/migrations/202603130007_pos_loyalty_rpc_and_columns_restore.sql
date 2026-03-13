-- Phase 2 POS loyalty restore: schema + RPC function (idempotent)

-- 1) Ensure required POS loyalty columns exist.
alter table if exists public.pos_sales
  add column if not exists customer_user_id uuid null,
  add column if not exists loyalty_status text null,
  add column if not exists loyalty_points_awarded integer not null default 0,
  add column if not exists loyalty_error text null;

-- 2) Ensure basic indexes for lookup/reporting.
create index if not exists pos_sales_customer_user_id_idx on public.pos_sales(customer_user_id);
create index if not exists pos_sales_customer_email_idx on public.pos_sales(customer_email);
create index if not exists pos_sales_created_at_idx on public.pos_sales(created_at desc);

-- 3) Minimal loyalty_transactions compatibility (only required columns).
create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id uuid not null,
  user_id uuid null,
  email text null,
  points_delta integer not null default 0,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.loyalty_transactions
  add column if not exists source_type text,
  add column if not exists source_id uuid,
  add column if not exists user_id uuid,
  add column if not exists email text,
  add column if not exists points_delta integer not null default 0,
  add column if not exists status text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists loyalty_transactions_source_unique_idx
  on public.loyalty_transactions(source_type, source_id);

create index if not exists loyalty_transactions_user_created_idx
  on public.loyalty_transactions(user_id, created_at desc);

-- Remove previous overloads so PostgREST RPC resolution is deterministic.
drop function if exists public.process_loyalty_accrual(text, uuid, text, int, uuid, jsonb);
drop function if exists public.process_loyalty_accrual(text, uuid, uuid, text, int, jsonb);

-- 4) Create the canonical RPC signature.
create or replace function public.process_loyalty_accrual(
  p_source_type text,
  p_source_id uuid,
  p_user_id uuid,
  p_email text,
  p_amount_cents integer,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
  v_normalized_email text;
  v_points integer;
begin
  if p_source_type is null or btrim(p_source_type) = '' or p_source_id is null then
    return jsonb_build_object(
      'status', 'error',
      'points_awarded', 0,
      'message', 'source_type/source_id inválido'
    );
  end if;

  select id, status, coalesce(points_delta, 0) as points_delta
  into v_existing
  from public.loyalty_transactions
  where source_type = p_source_type
    and source_id = p_source_id
  limit 1;

  if found then
    return jsonb_build_object(
      'status', 'duplicate',
      'points_awarded', coalesce(v_existing.points_delta, 0),
      'message', 'Transacción ya procesada'
    );
  end if;

  if coalesce(p_amount_cents, 0) <= 0 then
    return jsonb_build_object(
      'status', 'skipped_ineligible',
      'points_awarded', 0,
      'message', 'Monto no elegible para fidelidad'
    );
  end if;

  v_normalized_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  if v_normalized_email is null then
    return jsonb_build_object(
      'status', 'skipped_no_email',
      'points_awarded', 0,
      'message', 'Venta POS sin email'
    );
  end if;

  if p_user_id is null then
    return jsonb_build_object(
      'status', 'skipped_no_user',
      'points_awarded', 0,
      'message', 'No se encontró usuario para el email'
    );
  end if;

  v_points := floor(coalesce(p_amount_cents, 0) / 100.0);

  insert into public.loyalty_transactions (
    source_type,
    source_id,
    user_id,
    email,
    points_delta,
    status,
    metadata
  )
  values (
    p_source_type,
    p_source_id,
    p_user_id,
    v_normalized_email,
    greatest(v_points, 0),
    'applied',
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (source_type, source_id) do nothing;

  if not found then
    select id, status, coalesce(points_delta, 0) as points_delta
    into v_existing
    from public.loyalty_transactions
    where source_type = p_source_type
      and source_id = p_source_id
    limit 1;

    return jsonb_build_object(
      'status', 'duplicate',
      'points_awarded', coalesce(v_existing.points_delta, 0),
      'message', 'Transacción ya procesada'
    );
  end if;

  return jsonb_build_object(
    'status', 'applied',
    'points_awarded', greatest(v_points, 0),
    'message', 'Puntos aplicados correctamente'
  );
exception
  when others then
    return jsonb_build_object(
      'status', 'error',
      'points_awarded', 0,
      'message', sqlerrm
    );
end;
$$;

grant execute on function public.process_loyalty_accrual(text, uuid, uuid, text, integer, jsonb)
  to anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
