import { requireAdminPage } from "@/lib/auth";

type MoneyMeta = {
  source: "number" | "string" | "nullish" | "invalid";
  hadDecimal: boolean;
};

function toCentsWithMeta(value: unknown): { cents: number; meta: MoneyMeta } {
  if (value == null) return { cents: 0, meta: { source: "nullish", hadDecimal: false } };
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return { cents: 0, meta: { source: "invalid", hadDecimal: false } };
    const hadDecimal = !Number.isInteger(value);
    return { cents: hadDecimal ? Math.round(value * 100) : value, meta: { source: "number", hadDecimal } };
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return { cents: 0, meta: { source: "nullish", hadDecimal: false } };
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) return { cents: 0, meta: { source: "invalid", hadDecimal: false } };
    const hadDecimal = trimmed.includes(".");
    return { cents: hadDecimal ? Math.round(parsed * 100) : parsed, meta: { source: "string", hadDecimal } };
  }
  return { cents: 0, meta: { source: "invalid", hadDecimal: false } };
}

export default async function AdminDashboard() {
  const { supabase } = await requireAdminPage();

  const [{ data: lowStock }, onlineOrdersResult, onlineItemsResult, posRowsResult] = await Promise.all([
    supabase.from("products").select("id,name,qty,base_stock").or("base_stock.lte.5,qty.lte.5").limit(20),
    supabase.from("orders").select("id,total_cents").eq("status", "paid").eq("payment_status", "paid").eq("channel", "online"),
    supabase.from("order_items").select("product_id,name_snapshot,qty,line_total_cents,orders!inner(status,payment_status,channel)").eq("orders.status", "paid").eq("orders.payment_status", "paid").eq("orders.channel", "online"),
    supabase.from("pos_sales").select("id,created_at,product_id,product_name,qty,total,payment_method,payment_reference,customer_email"),
  ]);

  const onlineRows = (onlineOrdersResult.error?.message?.includes("column orders.channel does not exist")
    ? (await supabase.from("orders").select("id,total_cents").eq("status", "paid").eq("payment_status", "paid")).data
    : onlineOrdersResult.data) ?? [];

  const onlineItems = (onlineItemsResult.error?.message?.includes("orders.channel")
    ? (await supabase.from("order_items").select("product_id,name_snapshot,qty,line_total_cents,orders!inner(status,payment_status)").eq("orders.status", "paid").eq("orders.payment_status", "paid")).data
    : onlineItemsResult.data) ?? [];

  const posRows = posRowsResult.data ?? [];

  const onlineOrders = onlineRows.length;
  const physicalOrders = posRows.length;

  const onlineRevenue = onlineRows.reduce((sum, row) => sum + toCentsWithMeta(row.total_cents).cents, 0);
  const physicalRevenue = posRows.reduce((sum, row) => sum + toCentsWithMeta(row.total).cents, 0);
  const totalRevenue = onlineRevenue + physicalRevenue;
  const paidOrdersCount = onlineOrders + physicalOrders;
  const averageTicket = paidOrdersCount > 0 ? totalRevenue / paidOrdersCount : 0;

  const topMap = new Map<string, { name: string; units: number; revenue: number; onlineUnits: number; physicalUnits: number }>();

  for (const item of onlineItems) {
    const curr = topMap.get(item.product_id) ?? { name: item.name_snapshot, units: 0, revenue: 0, onlineUnits: 0, physicalUnits: 0 };
    const qty = Number(item.qty ?? 0);
    const revenue = toCentsWithMeta(item.line_total_cents).cents;
    curr.units += qty;
    curr.onlineUnits += qty;
    curr.revenue += revenue;
    topMap.set(item.product_id, curr);
  }

  for (const row of posRows) {
    const curr = topMap.get(row.product_id) ?? { name: row.product_name, units: 0, revenue: 0, onlineUnits: 0, physicalUnits: 0 };
    const qty = Number(row.qty ?? 0);
    const revenue = toCentsWithMeta(row.total).cents;
    curr.units += qty;
    curr.physicalUnits += qty;
    curr.revenue += revenue;
    topMap.set(row.product_id, curr);
  }

  const ranked = [...topMap.entries()]
    .map(([product_id, v]) => ({ product_id, name: v.name, units: v.units, revenue: v.revenue, onlineUnits: v.onlineUnits, physicalUnits: v.physicalUnits }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 10);

  const onlineTypeSample = onlineRows.slice(0, 5).map((r) => ({ value: r.total_cents, type: typeof r.total_cents }));
  const posTypeSample = posRows.slice(0, 5).map((r) => ({ value: r.total, type: typeof r.total }));
  const anyNaN = [onlineRevenue, physicalRevenue, totalRevenue, averageTicket].some((x) => Number.isNaN(x));

  console.log("[ADMIN_KPI] onlineRows count:", onlineRows.length);
  console.log("[ADMIN_KPI] posRows count:", posRows.length);
  console.log("[ADMIN_KPI] onlineRows sample:", onlineRows.slice(0, 3));
  console.log("[ADMIN_KPI] posRows sample:", posRows.slice(0, 3));
  console.log("[ADMIN_KPI] onlineRevenue raw:", onlineRevenue);
  console.log("[ADMIN_KPI] physicalRevenue raw:", physicalRevenue);
  console.log("[ADMIN_KPI] onlineOrders raw:", onlineOrders);
  console.log("[ADMIN_KPI] physicalOrders raw:", physicalOrders);
  console.log("[ADMIN_KPI] totalRevenue final:", totalRevenue);
  console.log("[ADMIN_KPI] averageTicket final:", averageTicket);
  console.log("[ADMIN_KPI] ranked sample:", ranked.slice(0, 3));
  console.log("[ADMIN_KPI] topProductsRevenue sample:", ranked.slice(0, 3).map((r) => ({ product: r.name, revenue_cents: r.revenue })));
  console.log("[ADMIN_KPI] orders.total_cents types:", onlineTypeSample);
  console.log("[ADMIN_KPI] pos_sales.total types:", posTypeSample);
  console.log("[ADMIN_KPI] hasStringOrNullish monetary values:", {
    online: onlineRows.some((r) => typeof r.total_cents === "string" || r.total_cents == null),
    pos: posRows.some((r) => typeof r.total === "string" || r.total == null),
  });
  console.log("[ADMIN_KPI] hadDecimal monetary values:", {
    online: onlineRows.slice(0, 20).map((r) => toCentsWithMeta(r.total_cents).meta.hadDecimal),
    pos: posRows.slice(0, 20).map((r) => toCentsWithMeta(r.total).meta.hadDecimal),
  });
  console.log("[ADMIN_KPI] anyNaN:", anyNaN);
  if (onlineOrdersResult.error) console.log("[ADMIN_KPI] onlineRows error:", onlineOrdersResult.error.message);
  if (onlineItemsResult.error) console.log("[ADMIN_KPI] onlineItems error:", onlineItemsResult.error.message);
  if (posRowsResult.error) console.log("[ADMIN_KPI] posRows error:", posRowsResult.error.message);

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
          <p className="text-3xl font-extrabold text-brand-ink">${(averageTicket / 100).toFixed(2)}</p>
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
