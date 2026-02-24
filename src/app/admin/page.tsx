import { createSupabaseServer } from "@/lib/supabase";

export default async function AdminDashboard() {
  const sb = await createSupabaseServer();
  const { count: orders } = await sb.from("orders").select("*", { count: "exact", head: true });
  const { data: lowStock } = await sb.from("products").select("id,name,base_stock").lte("base_stock", 5).limit(10);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p>Órdenes totales: {orders ?? 0}</p>
      <div>
        <h2 className="font-semibold">Stock bajo</h2>
        <ul>{(lowStock ?? []).map((p) => <li key={p.id}>{p.name} ({p.base_stock})</li>)}</ul>
      </div>
    </div>
  );
}
