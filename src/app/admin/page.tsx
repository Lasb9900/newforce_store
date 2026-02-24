import { requireOwnerPage } from "@/lib/auth";

export default async function AdminDashboard() {
  const { supabase } = await requireOwnerPage();
  const { count: orders } = await supabase.from("orders").select("*", { count: "exact", head: true });
  const { data: lowStock } = await supabase.from("products").select("id,name,base_stock").lte("base_stock", 5).limit(10);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p>Órdenes totales: {orders ?? 0}</p>
      <div>
        <h2 className="font-semibold">Stock bajo</h2>
        <ul>{(lowStock ?? []).map((p) => <li key={p.id}>{p.name} ({p.base_stock})</li>)}</ul>
      </div>
    </div>
  );
}
