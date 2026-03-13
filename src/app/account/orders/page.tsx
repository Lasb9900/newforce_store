import { requireCustomerPage } from "@/lib/auth";

type UnifiedOrder = {
  id: string;
  created_at: string;
  channel: "online" | "physical_store";
  total_cents: number;
  status: string;
  payment_method: string | null;
  points_earned: number;
  points_redeemed: number;
  items: Array<{ name: string; qty: number; unit_price_cents: number }>;
};

export default async function AccountOrdersPage() {
  const { supabase, user, profile } = await requireCustomerPage("/login?next=/account/orders");
  const normalizedProfileEmail = profile?.email?.trim().toLowerCase() ?? null;

  const { data: onlineOrders } = await supabase
    .from("orders")
    .select("id,created_at,total_cents,status,payment_method,points_earned,points_redeemed,order_items(name_snapshot,qty,unit_price_cents_snapshot)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const posByUser = await supabase
    .from("pos_sales")
    .select("id,created_at,total,payment_method,product_name,qty,price,customer_user_id,customer_email,loyalty_points_awarded")
    .eq("customer_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  let posSales: Array<Record<string, unknown>> = ((posByUser.data ?? []) as unknown as Array<Record<string, unknown>>);
  if (posByUser.error?.message?.includes("column pos_sales.customer_user_id does not exist") && normalizedProfileEmail) {
    const fallback = await supabase
      .from("pos_sales")
      .select("id,created_at,total,payment_method,product_name,qty,price,customer_email,loyalty_points_awarded")
      .eq("customer_email", normalizedProfileEmail)
      .order("created_at", { ascending: false })
      .limit(50);
    posSales = ((fallback.data ?? []) as unknown as Array<Record<string, unknown>>);
  } else if (normalizedProfileEmail) {
    const fallback = await supabase
      .from("pos_sales")
      .select("id,created_at,total,payment_method,product_name,qty,price,customer_user_id,customer_email,loyalty_points_awarded")
      .is("customer_user_id", null)
      .eq("customer_email", normalizedProfileEmail)
      .order("created_at", { ascending: false })
      .limit(50);

    const known = new Set(posSales.map((row) => String(row.id ?? "")));
    const byEmail = ((fallback.data ?? []) as unknown as Array<Record<string, unknown>>);
    posSales = [...posSales, ...byEmail.filter((row) => !known.has(String(row.id ?? "")))];
  }

  const unifiedOrders: UnifiedOrder[] = [
    ...(onlineOrders ?? []).map((order) => ({
      id: String(order.id),
      created_at: String(order.created_at),
      channel: "online" as const,
      total_cents: Number(order.total_cents ?? 0),
      status: String(order.status ?? "paid"),
      payment_method: (order.payment_method as string | null) ?? null,
      points_earned: Number(order.points_earned ?? 0),
      points_redeemed: Number(order.points_redeemed ?? 0),
      items: (order.order_items ?? []).map((item) => ({
        name: String(item.name_snapshot ?? "Producto"),
        qty: Number(item.qty ?? 0),
        unit_price_cents: Number(item.unit_price_cents_snapshot ?? 0),
      })),
    })),
    ...posSales.map((sale) => ({
      id: String(sale.id),
      created_at: String(sale.created_at),
      channel: "physical_store" as const,
      total_cents: Number(sale.total ?? 0),
      status: "paid",
      payment_method: (sale.payment_method as string | null) ?? null,
      points_earned: Number(sale.loyalty_points_awarded ?? 0),
      points_redeemed: 0,
      items: [
        {
          name: String(sale.product_name ?? "Producto POS"),
          qty: Number(sale.qty ?? 0),
          unit_price_cents: Number(sale.price ?? 0),
        },
      ],
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="rounded-xl border border-uiBorder bg-surface p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold">Historial de compras</h1>
      <div className="space-y-3">
        {unifiedOrders.map((order) => (
          <article key={`${order.channel}-${order.id}`} className="rounded-md border border-uiBorder p-3">
            <p className="text-sm font-semibold">{new Date(order.created_at).toLocaleString()} · {order.channel}</p>
            <p className="text-sm text-mutedText">${(order.total_cents / 100).toFixed(2)} · {order.status} · {order.payment_method || "n/a"}</p>
            <p className="text-xs text-mutedText">Puntos: +{order.points_earned} / -{order.points_redeemed}</p>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {order.items.map((item, idx) => (
                <li key={`${order.id}-${idx}`}>{item.name} x{item.qty} · ${(item.unit_price_cents / 100).toFixed(2)}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
