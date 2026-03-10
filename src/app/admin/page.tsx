import { requireAdminPage } from "@/lib/auth";

export default async function AdminDashboard() {
  const { supabase } = await requireAdminPage();

  const [{ data: kpi }, { data: topProducts }, { data: channels }, { data: lowStock }] = await Promise.all([
    supabase.from("admin_sales_kpis").select("*").single(),
    supabase
      .from("admin_top_products")
      .select("product_id,product_name,units_sold,revenue_cents,online_units,physical_units")
      .order("units_sold", { ascending: false })
      .limit(10),
    supabase.from("orders").select("channel,total_cents").eq("status", "paid").eq("payment_status", "paid"),
    supabase.from("products").select("id,name,base_stock").lte("base_stock", 5).limit(8),
  ]);

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
          <h2 className="mb-2 text-lg font-bold">Top productos (online + POS)</h2>
          <ul className="space-y-2 text-sm">
            {(topProducts ?? []).map((p) => (
              <li key={p.product_id} className="rounded-md border border-uiBorder px-3 py-2">
                <p className="font-medium">{p.product_name}</p>
                <p className="text-mutedText">Unidades: {p.units_sold} (Online {p.online_units} · POS {p.physical_units}) · Ingresos: ${((p.revenue_cents ?? 0) / 100).toFixed(2)}</p>
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
