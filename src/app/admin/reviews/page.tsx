import { createSupabaseServer } from "@/lib/supabase";

export default async function AdminReviews() {
  const sb = await createSupabaseServer();
  const { data } = await sb.from("reviews").select("id,comment,rating,status,product_id").order("created_at", { ascending: false }).limit(100);
  return <div><h1 className="mb-4 text-2xl font-bold">Reviews</h1><ul>{(data??[]).map((r)=><li key={r.id}>{r.rating}/5 - {r.status} - {r.comment}</li>)}</ul></div>;
}
