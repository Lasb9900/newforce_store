import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase";

export default async function AdminProducts() {
  const sb = await createSupabaseServer();
  const { data } = await sb.from("products").select("id,name,active,has_variants,featured").order("created_at", { ascending: false });
  return <div><h1 className="mb-4 text-2xl font-bold">Productos</h1><table className="w-full text-sm"><thead><tr><th>Nombre</th><th>Activo</th><th>Variantes</th><th>Featured</th></tr></thead><tbody>{(data??[]).map((p)=><tr key={p.id}><td>{p.name}</td><td>{String(p.active)}</td><td>{String(p.has_variants)}</td><td>{String(p.featured)}</td></tr>)}</tbody></table><Link className="mt-3 inline-block underline" href="/api/admin/products">Gestionar API</Link></div>;
}
