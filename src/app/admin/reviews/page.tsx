import { requireOwnerPage } from "@/lib/auth";

export default async function AdminReviews() {
  const { supabase } = await requireOwnerPage();
  const { data } = await supabase.from("reviews").select("id,comment,rating,status,product_id").order("created_at", { ascending: false }).limit(100);
  return <div className="rounded-lg border border-slate-200 bg-white p-6"><h1 className="mb-4 text-2xl font-bold">Reviews</h1><ul>{(data??[]).map((r)=><li key={r.id}>{r.rating}/5 - {r.status} - {r.comment}</li>)}</ul></div>;
}
