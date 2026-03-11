import { requireOwnerPage } from "@/lib/auth";

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase } = await requireOwnerPage();
  const params = await searchParams;
  const channel = typeof params.channel === "string" ? params.channel : "";

  let query = supabase
    .from("orders")
    .select("id,buyer_email,total_cents,status,payment_status,payment_method,payment_reference,channel,points_earned,points_redeemed,created_at")
    .eq("status", "paid")
    .eq("payment_status", "paid")
    .order("created_at", { ascending: false })
    .limit(100);

  if (channel) query = query.eq("channel", channel);

  const { data } = await query;

  return (
    <div className="rounded-xl border border-uiBorder bg-surface p-6 shadow-sm space-y-4">
      <h1 className="text-2xl font-bold">Ventas (pagadas)</h1>
      <form className="flex gap-2 text-sm">
        <select name="channel" defaultValue={channel} className="rounded border border-uiBorder p-2">
          <option value="">Todos los canales</option>
          <option value="online">Online</option>
          <option value="physical_store">POS / Tienda física</option>
        </select>
        <button className="btn-primary" type="submit">Filtrar</button>
      </form>
      <ul className="space-y-2 text-sm">
        {(data ?? []).map((o) => (
          <li key={o.id} className="rounded-md border border-uiBorder px-3 py-2">
            <p className="font-medium text-brand-ink">{o.id}</p>
            <p className="text-mutedText">{o.buyer_email} · {o.status}/{o.payment_status} · {o.payment_method ?? "—"} · Ref: {o.payment_reference ?? "—"} · {o.channel} · ${(o.total_cents / 100).toFixed(2)} · +{o.points_earned}/-{o.points_redeemed} pts</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
