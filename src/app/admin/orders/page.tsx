import { createSupabaseServer } from "@/lib/supabase";

export default async function AdminOrders() {
  const sb = await createSupabaseServer();
  const { data } = await sb.from("orders").select("id,buyer_email,total_cents,status,created_at").order("created_at", { ascending: false }).limit(50);
  return <div><h1 className="mb-4 text-2xl font-bold">Órdenes</h1><ul>{(data??[]).map((o)=><li key={o.id}>{o.id} - {o.buyer_email} - {o.status} - ${o.total_cents/100}</li>)}</ul></div>;
}
