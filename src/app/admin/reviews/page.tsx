import { requireOwnerPage } from "@/lib/auth";

export default async function AdminReviews() {
  const { supabase } = await requireOwnerPage();
  const { data } = await supabase.from("reviews").select("id,comment,rating,status,product_id").order("created_at", { ascending: false }).limit(100);

  return (
    <div className="rounded-xl border border-uiBorder bg-surface p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold">Reviews</h1>
      <ul className="space-y-2 text-sm">
        {(data ?? []).map((r) => (
          <li key={r.id} className="rounded-md border border-uiBorder px-3 py-2">
            <p className="font-medium text-brand-ink">{r.rating}/5 · {r.status}</p>
            <p className="text-mutedText">{r.comment}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
