import { requireOwnerPage } from "@/lib/auth";

export default async function AdminOrders() {
  const { supabase } = await requireOwnerPage();
  const { data } = await supabase.from("orders").select("id,buyer_email,total_cents,status,created_at").order("created_at", { ascending: false }).limit(50);

  return (
    <div className="rounded-xl border border-uiBorder bg-surface p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold">Órdenes</h1>
      <ul className="space-y-2 text-sm">
        {(data ?? []).map((o) => (
          <li key={o.id} className="rounded-md border border-uiBorder px-3 py-2">
            <p className="font-medium text-brand-ink">{o.id}</p>
            <p className="text-mutedText">{o.buyer_email} · {o.status} · ${(o.total_cents / 100).toFixed(2)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
