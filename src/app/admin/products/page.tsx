import { requireOwnerPage } from "@/lib/auth";

export default async function AdminProducts() {
  const { supabase } = await requireOwnerPage();
  const { data } = await supabase.from("products").select("id,name,active,has_variants,featured").order("created_at", { ascending: false });

  return (
    <div className="rounded-xl border border-uiBorder bg-surface p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold">Productos</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surfaceMuted text-left text-mutedText">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Activo</th>
              <th className="px-3 py-2">Variantes</th>
              <th className="px-3 py-2">Featured</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((p) => (
              <tr key={p.id} className="border-t border-uiBorder">
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2">{String(p.active)}</td>
                <td className="px-3 py-2">{String(p.has_variants)}</td>
                <td className="px-3 py-2">{String(p.featured)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
