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
  v_amount_cents int := greatest(coalesce(p_amount_cents, 0), 0);
  v_sale_customer_email text;
  v_sale_customer_user_id uuid;
  v_sale_total int;
begin
  if p_source_type not in ('online_order', 'pos_sale') then
    raise exception 'Invalid source type: %', p_source_type;
  end if;

  if p_source_type = 'pos_sale' then
    begin
      select
        nullif(lower(trim(coalesce(ps.customer_email, ''))), ''),
        ps.customer_user_id,
        coalesce(ps.total, 0)
      into
        v_sale_customer_email,
        v_sale_customer_user_id,
        v_sale_total
      from public.pos_sales ps
      where ps.id = p_source_id
      limit 1;
    exception
      when undefined_column then
        select
          nullif(lower(trim(coalesce(ps.customer_email, ''))), ''),
          null::uuid,
          coalesce(ps.total, 0)
        into
          v_sale_customer_email,
          v_sale_customer_user_id,
          v_sale_total
        from public.pos_sales ps
        where ps.id = p_source_id
        limit 1;
    end;

    v_email := coalesce(v_email, v_sale_customer_email);
    v_user_id := coalesce(v_user_id, v_sale_customer_user_id);
    if v_amount_cents <= 0 then
      v_amount_cents := greatest(coalesce(v_sale_total, 0), 0);
    end if;
  end if;

  insert into public.loyalty_transactions (
    source_type, source_id, status, amount_cents, email_snapshot, metadata, user_id, points_delta
  )
  values (
    p_source_type,
    p_source_id,
    'pending',
    v_amount_cents,
    v_email,
    coalesce(p_metadata, '{}'::jsonb),
    v_user_id,
    0
  )
  on conflict (source_type, source_id) do nothing
  returning id into v_tx_id;

  if v_tx_id is null then
    select * into v_existing
    from public.loyalty_transactions
    where source_type = p_source_type and source_id = p_source_id;

    return query
    select v_existing.id, 'duplicate'::text, 0::int, v_existing.user_id, v_existing.email_snapshot;
    return;
  end if;

  if v_user_id is null and p_source_type = 'online_order' then
    select o.user_id into v_user_id
    from public.orders o
    where o.id = p_source_id
    limit 1;
  end if;

  if v_user_id is null and v_email is not null then
    select p.user_id into v_user_id
    from public.profiles p
    where lower(trim(coalesce(p.email, ''))) = v_email
    limit 1;
  end if;

  if v_amount_cents <= 0 then
    v_status := 'skipped_ineligible';
  elsif floor(v_amount_cents / 100.0)::int <= 0 then
    v_status := 'skipped_ineligible';
  elsif v_user_id is not null then
    v_status := 'applied';
  elsif v_email is null then
    v_status := 'skipped_no_email';
  else
    v_status := 'skipped_no_user';
  end if;

  v_points := case when v_status = 'applied' then floor(v_amount_cents / 100.0)::int else 0 end;

  if v_status = 'applied' then
    insert into public.customer_points (user_id, balance)
    values (v_user_id, v_points)
    on conflict (user_id)
    do update set balance = public.customer_points.balance + excluded.balance, updated_at = now();

    if p_source_type = 'online_order' then
      insert into public.points_ledger (user_id, order_id, type, points_delta, description)
      values (
        v_user_id,
        p_source_id,
        'earn',
        v_points,
        format('Puntos por compra online %s', p_source_id)
      )
      on conflict (order_id, type) where (type = 'earn' and order_id is not null) do nothing;

      update public.orders
      set user_id = coalesce(public.orders.user_id, v_user_id),
          points_earned = greatest(coalesce(public.orders.points_earned, 0), v_points),
          updated_at = now()
      where id = p_source_id;
    else
      insert into public.points_ledger (user_id, order_id, type, points_delta, description)
      values (v_user_id, null, 'earn', v_points, format('Puntos por venta POS %s', p_source_id));
    end if;
  end if;

  if p_source_type = 'pos_sale' then
    begin
      update public.pos_sales ps
      set customer_user_id = coalesce(ps.customer_user_id, v_user_id),
          loyalty_status = v_status,
          loyalty_points_awarded = v_points,
          loyalty_processed_at = now(),
          loyalty_error = null
      where ps.id = p_source_id;
    exception
      when undefined_column then
        update public.pos_sales ps
        set loyalty_status = v_status,
            loyalty_points_awarded = v_points,
            loyalty_error = null
        where ps.id = p_source_id;
    end;
  end if;

  update public.loyalty_transactions
  set user_id = v_user_id,
      status = v_status,
      points_delta = v_points,
      amount_cents = v_amount_cents,
      email_snapshot = coalesce(v_email, email_snapshot),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
  where id = v_tx_id;

  return query select v_tx_id, v_status, v_points, v_user_id, v_email;

exception
  when others then
    if v_tx_id is not null then
      update public.loyalty_transactions
      set status = 'error',
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('error', sqlerrm),
          updated_at = now()
      where id = v_tx_id;
    end if;

    if p_source_type = 'pos_sale' then
      begin
        update public.pos_sales
        set loyalty_status = 'error',
            loyalty_error = sqlerrm,
            loyalty_processed_at = now()
        where id = p_source_id;
      exception
        when undefined_column then
          null;
      end;
    end if;

    raise;
end;
$$;
