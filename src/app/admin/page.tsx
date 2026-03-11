import { requireAdminPage } from "@/lib/auth";

export default async function AdminDashboard() {
  const { supabase } = await requireAdminPage();

  const [{ data: topRows }, { data: lowStock }, { data: onlinePaidOrders }, { data: kpisView }] = await Promise.all([
    supabase.from("admin_top_products").select("product_id,product_name,units_sold,revenue_cents,online_units,physical_units").order("units_sold", { ascending: false }).limit(10),
    supabase.from("products").select("id,name,qty,base_stock").or("base_stock.lte.5,qty.lte.5").limit(20),
    supabase.from("orders").select("id,total_cents").eq("status", "paid").eq("payment_status", "paid").eq("channel", "online"),
    supabase.from("admin_sales_kpis").select("online_revenue_cents,physical_revenue_cents,online_orders,physical_orders,paid_orders").single(),
  ]);

  let onlineOrders = (onlinePaidOrders ?? []).length;
  let onlineRevenue = (onlinePaidOrders ?? []).reduce((sum, row) => sum + Number(row.total_cents ?? 0), 0);

  let posRows: Array<{ id: string; order_id?: string | null; total: number | null }> = [];
  const withOrderId = await supabase.from("pos_sales").select("id,order_id,total");
  if (withOrderId.error?.message?.includes("column pos_sales.order_id does not exist")) {
    const withoutOrderId = await supabase.from("pos_sales").select("id,total");
    posRows = (withoutOrderId.data ?? []).map((row) => ({ ...row, order_id: null }));
  } else {
    posRows = withOrderId.data ?? [];
  }

  let physicalRevenue = posRows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  let physicalOrders = new Set(posRows.map((row) => row.order_id ?? row.id)).size;

  if (physicalRevenue === 0 && Number(kpisView?.physical_revenue_cents ?? 0) > 0) {
    physicalRevenue = Number(kpisView?.physical_revenue_cents ?? 0);
  }
  if (physicalOrders === 0 && Number(kpisView?.physical_orders ?? 0) > 0) {
    physicalOrders = Number(kpisView?.physical_orders ?? 0);
  }

  let totalRevenue = onlineRevenue + physicalRevenue;
  let paidOrdersCount = onlineOrders + physicalOrders;

  if (paidOrdersCount === 0 && Number(kpisView?.paid_orders ?? 0) > 0) {
    paidOrdersCount = Number(kpisView?.paid_orders ?? 0);
  }

  let ranked = (topRows ?? []).map((row) => ({
    product_id: row.product_id,
    name: row.product_name,
    units: Number(row.units_sold ?? 0),
    revenue: Number(row.revenue_cents ?? 0),
    onlineUnits: Number(row.online_units ?? 0),
    physicalUnits: Number(row.physical_units ?? 0),
  }));

  if (!topRows) {
    const [{ data: paidOrders }, { data: orderItems }, { data: posRows }] = await Promise.all([
      supabase.from("orders").select("id,total_cents,channel,status,payment_status").eq("status", "paid").eq("payment_status", "paid"),
      supabase.from("order_items").select("order_id,product_id,name_snapshot,qty,line_total_cents"),
      supabase.from("pos_sales").select("id,product_id,product_name,qty,total").order("created_at", { ascending: false }).limit(1000),
    ]);

    const online = (paidOrders ?? []).filter((o) => o.channel === "online");
    const physical = (paidOrders ?? []).filter((o) => o.channel === "physical_store");
    onlineOrders = online.length;
    physicalOrders = physical.length;
    onlineRevenue = online.reduce((sum, o) => sum + Number(o.total_cents ?? 0), 0);
    physicalRevenue = physical.reduce((sum, o) => sum + Number(o.total_cents ?? 0), 0);
    totalRevenue = onlineRevenue + physicalRevenue;
    paidOrdersCount = (paidOrders ?? []).length;

    const orderIds = new Set((paidOrders ?? []).map((o) => o.id));
    const topMap = new Map<string, { name: string; units: number; revenue: number; onlineUnits: number; physicalUnits: number }>();
    for (const item of orderItems ?? []) {
      if (!orderIds.has(item.order_id)) continue;
      const curr = topMap.get(item.product_id) ?? { name: item.name_snapshot, units: 0, revenue: 0, onlineUnits: 0, physicalUnits: 0 };
      curr.units += Number(item.qty ?? 0);
      curr.revenue += Number(item.line_total_cents ?? 0);
      topMap.set(item.product_id, curr);
    }
    for (const pos of posRows ?? []) {
      const curr = topMap.get(pos.product_id) ?? { name: pos.product_name, units: 0, revenue: 0, onlineUnits: 0, physicalUnits: 0 };
      curr.units += Number(pos.qty ?? 0);
      curr.revenue += Number(pos.total ?? 0);
      curr.physicalUnits += Number(pos.qty ?? 0);
      topMap.set(pos.product_id, curr);
    }
    ranked = [...topMap.entries()]
      .map(([product_id, v]) => ({ product_id, name: v.name, units: v.units, revenue: v.revenue, onlineUnits: v.onlineUnits, physicalUnits: v.physicalUnits }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 10);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <p className="text-sm text-mutedText">Total vendido</p>
          <p className="text-3xl font-extrabold text-brand-ink">${(totalRevenue / 100).toFixed(2)}</p>
        </article>
        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <p className="text-sm text-mutedText">Ventas online / físicas</p>
          <p className="text-xl font-bold">{onlineOrders} / {physicalOrders}</p>
          <p className="text-xs text-mutedText">Ingresos: ${(onlineRevenue / 100).toFixed(2)} / ${(physicalRevenue / 100).toFixed(2)}</p>
        </article>
        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <p className="text-sm text-mutedText">Ticket promedio</p>
          <p className="text-3xl font-extrabold text-brand-ink">${((totalRevenue / Math.max(paidOrdersCount, 1)) / 100).toFixed(2)}</p>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">Top productos (online + POS)</h2>
          <ul className="space-y-2 text-sm">
            {ranked.map((p) => (
              <li key={p.product_id} className="rounded-md border border-uiBorder px-3 py-2">
                <p className="font-medium">{p.name}</p>
                <p className="text-mutedText">Unidades: {p.units} (Online {p.onlineUnits} · POS {p.physicalUnits}) · Ingresos: ${(p.revenue / 100).toFixed(2)}</p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">Stock bajo</h2>
          <ul className="space-y-2 text-sm">
            {(lowStock ?? [])
              .map((p) => ({
                ...p,
                operationalStock: Math.min(p.qty ?? Number.POSITIVE_INFINITY, p.base_stock ?? Number.POSITIVE_INFINITY),
              }))
              .filter((p) => Number.isFinite(p.operationalStock) && p.operationalStock <= 5)
              .sort((a, b) => a.operationalStock - b.operationalStock)
              .slice(0, 8)
              .map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-md border border-uiBorder px-3 py-2">
                  <span>{p.name}</span>
                  <span className="rounded-full bg-brand-accent/10 px-2 py-1 text-xs font-semibold text-brand-accent">{p.operationalStock}</span>
                </li>
              ))}
          </ul>
        </article>
      </div>
    </div>
  );
}
