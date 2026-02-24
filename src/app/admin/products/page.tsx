import { requireOwnerPage } from "@/lib/auth";

export default async function AdminProducts() {
  const { supabase } = await requireOwnerPage();
  const { data } = await supabase.from("products").select("id,name,active,has_variants,featured").order("created_at", { ascending: false });
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h1 className="mb-4 text-2xl font-bold">Productos</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left"><th>Nombre</th><th>Activo</th><th>Variantes</th><th>Featured</th></tr>
        </thead>
        <tbody>
          {(data ?? []).map((p) => <tr key={p.id}><td>{p.name}</td><td>{String(p.active)}</td><td>{String(p.has_variants)}</td><td>{String(p.featured)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}
