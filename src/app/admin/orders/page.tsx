import { requireOwnerPage } from "@/lib/auth";

export default async function AdminOrders() {
  const { supabase } = await requireOwnerPage();
  const { data } = await supabase.from("orders").select("id,buyer_email,total_cents,status,created_at").order("created_at", { ascending: false }).limit(50);
  return <div className="rounded-lg border border-slate-200 bg-white p-6"><h1 className="mb-4 text-2xl font-bold">Órdenes</h1><ul>{(data??[]).map((o)=><li key={o.id}>{o.id} - {o.buyer_email} - {o.status} - ${o.total_cents/100}</li>)}</ul></div>;
}
