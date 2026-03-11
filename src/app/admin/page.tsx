import { requireAdminPage } from "@/lib/auth";

export default async function AdminDashboard() {
  const { supabase } = await requireAdminPage();

  const [{ data: paidOrders }, { data: topRows }, { data: lowStock }] = await Promise.all([
    supabase.from("orders").select("id,total_cents,channel,status,payment_status").eq("status", "paid").eq("payment_status", "paid"),
    supabase.from("order_items").select("order_id,product_id,name_snapshot,qty,line_total_cents"),
    supabase.from("products").select("id,name,qty,base_stock").or("base_stock.lte.5,qty.lte.5").limit(20),
  ]);

  const paidOrdersMap = new Map((paidOrders ?? []).map((o) => [o.id, o]));

  const revenueByOrder = new Map<string, number>();
  const itemRevenueByOrder = new Map<string, number>();
  for (const order of paidOrders ?? []) {
    revenueByOrder.set(order.id, Math.max(Number(order.total_cents ?? 0), 0));
  }
  for (const row of topRows ?? []) {
    const order = paidOrdersMap.get(row.order_id);
    if (!order) continue;
    const current = itemRevenueByOrder.get(row.order_id) ?? 0;
    itemRevenueByOrder.set(row.order_id, Math.max(current, 0) + Math.max(Number(row.line_total_cents ?? 0), 0));
  }
  for (const [orderId, itemRevenue] of itemRevenueByOrder.entries()) {
    revenueByOrder.set(orderId, itemRevenue);
  }

  const onlineOrders = (paidOrders ?? []).filter((o) => o.channel === "online");
  const physicalOrders = (paidOrders ?? []).filter((o) => o.channel === "physical_store");
  const onlineRevenue = onlineOrders.reduce((sum, o) => sum + (revenueByOrder.get(o.id) ?? 0), 0);
  const physicalRevenue = physicalOrders.reduce((sum, o) => sum + (revenueByOrder.get(o.id) ?? 0), 0);
  const totalRevenue = onlineRevenue + physicalRevenue;
  const paidOrdersCount = (paidOrders ?? []).length;

  const topByUnits = new Map<string, { name: string; units: number; revenue: number; onlineUnits: number; physicalUnits: number }>();
  for (const row of topRows ?? []) {
    const order = paidOrdersMap.get(row.order_id);
    if (!order) continue;

    const current = topByUnits.get(row.product_id) ?? {
      name: row.name_snapshot,
      units: 0,
      revenue: 0,
      onlineUnits: 0,
      physicalUnits: 0,
    };

    current.units += row.qty ?? 0;
    current.revenue += row.line_total_cents ?? 0;
    if (order.channel === "online") current.onlineUnits += row.qty ?? 0;
    if (order.channel === "physical_store") current.physicalUnits += row.qty ?? 0;
    topByUnits.set(row.product_id, current);
  }
  const ranked = [...topByUnits.entries()]
    .map(([productId, value]) => ({ product_id: productId, ...value }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 10);

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
          <p className="text-xl font-bold">{onlineOrders.length} / {physicalOrders.length}</p>
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
