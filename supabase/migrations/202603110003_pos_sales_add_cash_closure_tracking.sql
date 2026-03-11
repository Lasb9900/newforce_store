-- Track whether a POS sale is already included in a cash closure.

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'pos_sales'
      and c.relkind = 'r'
  ) then
    execute $sql$
      alter table public.pos_sales
        add column if not exists cash_closure_id uuid references public.pos_cash_closures(id) on delete set null,
        add column if not exists closed_at timestamptz
    $sql$;

    execute 'create index if not exists idx_pos_sales_cash_closure_id on public.pos_sales(cash_closure_id)';
    execute 'create index if not exists idx_pos_sales_closed_at on public.pos_sales(closed_at)';
  end if;
end
$$;

notify pgrst, 'reload schema';
