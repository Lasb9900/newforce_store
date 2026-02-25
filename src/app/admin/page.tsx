import { requireOwnerPage } from "@/lib/auth";

export default async function AdminDashboard() {
  const { supabase } = await requireOwnerPage();
  const { count: orders } = await supabase.from("orders").select("*", { count: "exact", head: true });
  const { data: lowStock } = await supabase.from("products").select("id,name,base_stock").lte("base_stock", 5).limit(10);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <p className="text-sm text-mutedText">Órdenes totales</p>
          <p className="text-3xl font-extrabold text-brand-ink">{orders ?? 0}</p>
          <span className="inline-block rounded-full bg-brand-accent/10 px-2 py-1 text-xs font-semibold text-brand-accent">KPI</span>
        </article>
        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm md:col-span-2">
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
