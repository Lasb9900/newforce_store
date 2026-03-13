import { requireCustomerPage } from "@/lib/auth";

export default async function AccountOrdersPage() {
  const { supabase, user, profile } = await requireCustomerPage("/login?next=/account/orders");

  const normalizedProfileEmail = profile?.email?.trim().toLowerCase() ?? null;
  if (normalizedProfileEmail) {
    await supabase
      .from("orders")
      .update({ user_id: user.id })
      .eq("channel", "physical_store")
      .is("user_id", null)
      .eq("buyer_email", normalizedProfileEmail);
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id,created_at,total_cents,status,channel,payment_method,points_earned,points_redeemed,order_items(name_snapshot,qty,unit_price_cents_snapshot)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="rounded-xl border border-uiBorder bg-surface p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold">Historial de compras</h1>
      <div className="space-y-3">
        {(orders ?? []).map((order) => (
          <article key={order.id} className="rounded-md border border-uiBorder p-3">
            <p className="text-sm font-semibold">{new Date(order.created_at).toLocaleString()} · {order.channel}</p>
            <p className="text-sm text-mutedText">${(order.total_cents / 100).toFixed(2)} · {order.status} · {order.payment_method || "n/a"}</p>
            <p className="text-xs text-mutedText">Puntos: +{order.points_earned} / -{order.points_redeemed}</p>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {(order.order_items ?? []).map((item, idx) => (
                <li key={`${order.id}-${idx}`}>{item.name_snapshot} x{item.qty} · ${(item.unit_price_cents_snapshot / 100).toFixed(2)}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
