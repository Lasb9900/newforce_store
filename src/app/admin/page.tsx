import { requireAdminPage } from "@/lib/auth";

export default async function AdminDashboard() {
  const { supabase } = await requireAdminPage();

  const [{ data: kpi }, { data: topProducts }, { data: channels }, { data: lowStock }] = await Promise.all([
    supabase.from("admin_sales_kpis").select("*").single(),
    supabase
      .from("order_items")
      .select("product_id,name_snapshot,qty,line_total_cents")
      .order("qty", { ascending: false })
      .limit(10),
    supabase.from("orders").select("channel,total_cents").eq("status", "paid").eq("payment_status", "paid"),
    supabase.from("products").select("id,name,base_stock").lte("base_stock", 5).limit(8),
  ]);

  const topByUnits = new Map<string, { name: string; units: number; revenue: number }>();
  for (const row of topProducts ?? []) {
    const current = topByUnits.get(row.product_id) ?? { name: row.name_snapshot, units: 0, revenue: 0 };
    current.units += row.qty;
    current.revenue += row.line_total_cents ?? 0;
    topByUnits.set(row.product_id, current);
  }
  const ranked = [...topByUnits.values()].sort((a, b) => b.units - a.units).slice(0, 10);

  const onlineRevenue = channels?.filter((c) => c.channel === "online").reduce((sum, c) => sum + c.total_cents, 0) ?? 0;
  const physicalRevenue = channels?.filter((c) => c.channel === "physical_store").reduce((sum, c) => sum + c.total_cents, 0) ?? 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <p className="text-sm text-mutedText">Total vendido</p>
          <p className="text-3xl font-extrabold text-brand-ink">${((kpi?.total_revenue_cents ?? 0) / 100).toFixed(2)}</p>
        </article>
        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <p className="text-sm text-mutedText">Ventas online / físicas</p>
          <p className="text-xl font-bold">{kpi?.online_orders ?? 0} / {kpi?.physical_orders ?? 0}</p>
          <p className="text-xs text-mutedText">Ingresos: ${(onlineRevenue / 100).toFixed(2)} / ${(physicalRevenue / 100).toFixed(2)}</p>
        </article>
        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <p className="text-sm text-mutedText">Ticket promedio</p>
          <p className="text-3xl font-extrabold text-brand-ink">${(((kpi?.total_revenue_cents ?? 0) / Math.max(kpi?.paid_orders ?? 1, 1)) / 100).toFixed(2)}</p>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">Top productos</h2>
          <ul className="space-y-2 text-sm">
            {ranked.map((p) => (
              <li key={p.name} className="rounded-md border border-uiBorder px-3 py-2">
                <p className="font-medium">{p.name}</p>
                <p className="text-mutedText">Unidades: {p.units} · Ingresos: ${(p.revenue / 100).toFixed(2)}</p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">Stock bajo</h2>
          <ul className="space-y-2 text-sm">
            {(lowStock ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-md border border-uiBorder px-3 py-2">
                <span>{p.name}</span>
                <span className="rounded-full bg-brand-accent/10 px-2 py-1 text-xs font-semibold text-brand-accent">{p.base_stock}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );
}
