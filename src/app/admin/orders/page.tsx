import { requireOwnerPage } from "@/lib/auth";

type AdminSaleRow = {
  id: string;
  created_at: string;
  channel: "online" | "physical_store";
  customer: string;
  product_summary: string;
  quantity: number;
  total_cents: number;
  payment_method: string;
  payment_reference: string;
  status: string;
};

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase } = await requireOwnerPage();

  const params = await searchParams;
  const channel = typeof params.channel === "string" ? params.channel : "";

  const [onlineResult, onlineItemsResult, posResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id,buyer_email,total_cents,status,payment_status,payment_method,payment_reference,channel,created_at")
      .eq("status", "paid")
      .eq("payment_status", "paid")
      .eq("channel", "online")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("order_items").select("order_id,name_snapshot,qty"),
    supabase
      .from("pos_sales")
      .select("id,created_at,product_name,qty,total,payment_method,payment_reference,customer_email")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const onlineRows = onlineResult.data ?? [];
  const posRows = posResult.data ?? [];
  const onlineItems = onlineItemsResult.data ?? [];

  const itemsByOrderId = new Map<string, Array<{ name_snapshot: string; qty: number }>>();
  for (const item of onlineItems) {
    const list = itemsByOrderId.get(item.order_id) ?? [];
    list.push({ name_snapshot: item.name_snapshot, qty: Number(item.qty ?? 0) });
    itemsByOrderId.set(item.order_id, list);
  }

  const unifiedOnline: AdminSaleRow[] = onlineRows.map((row) => {
    const items = itemsByOrderId.get(row.id) ?? [];
    const quantity = items.reduce((sum, x) => sum + Number(x.qty ?? 0), 0);
    const productSummary = items.length > 0 ? items.slice(0, 2).map((x) => x.name_snapshot).join(", ") : "—";

    return {
      id: row.id,
      created_at: row.created_at,
      channel: "online",
      customer: row.buyer_email ?? "—",
      product_summary: productSummary,
      quantity,
      total_cents: Number(row.total_cents ?? 0),
      payment_method: row.payment_method ?? "—",
      payment_reference: row.payment_reference ?? "—",
      status: `${row.status}/${row.payment_status}`,
    };
  });

  const unifiedPos: AdminSaleRow[] = posRows.map((row) => ({
    id: row.id,
    created_at: row.created_at,
    channel: "physical_store",
    customer: row.customer_email ?? "—",
    product_summary: row.product_name ?? "—",
    quantity: Number(row.qty ?? 0),
    total_cents: Number(row.total ?? 0),
    payment_method: row.payment_method ?? "—",
    payment_reference: row.payment_reference ?? "—",
    status: "paid/paid",
  }));

  const mergedRows = [...unifiedOnline, ...unifiedPos].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const filteredRows = channel ? mergedRows.filter((row) => row.channel === channel) : mergedRows;

  console.log("[ADMIN_ORDERS] selected channel filter:", channel || "all");
  console.log("[ADMIN_ORDERS] online rows count:", unifiedOnline.length);
  console.log("[ADMIN_ORDERS] pos rows count:", unifiedPos.length);
  console.log("[ADMIN_ORDERS] merged rows count:", mergedRows.length);
  console.log("[ADMIN_ORDERS] online sample:", unifiedOnline.slice(0, 3));
  console.log("[ADMIN_ORDERS] pos sample:", unifiedPos.slice(0, 3));
  if (onlineResult.error) console.log("[ADMIN_ORDERS] online query error:", onlineResult.error.message);
  if (onlineItemsResult.error) console.log("[ADMIN_ORDERS] online items query error:", onlineItemsResult.error.message);
  if (posResult.error) console.log("[ADMIN_ORDERS] pos query error:", posResult.error.message);

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
        {filteredRows.map((o) => (
          <li key={`${o.channel}-${o.id}`} className="rounded-md border border-uiBorder px-3 py-2">
            <p className="font-medium text-brand-ink">{o.id}</p>
            <p className="text-mutedText">{o.customer} · {o.status} · {o.payment_method} · Ref: {o.payment_reference} · {o.channel} · {o.product_summary} · Qty {o.quantity} · ${(o.total_cents / 100).toFixed(2)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
