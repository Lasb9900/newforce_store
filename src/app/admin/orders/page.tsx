import { requireOwnerPage } from "@/lib/auth";

type AdminSaleRow = {
  id: string;
  created_at: string;
  channel: "online" | "physical_store";
  customer: string;
  customer_name: string;
  customer_phone: string;
  product_summary: string;
  quantity: number;
  total_cents: number;
  payment_method: string;
  payment_reference: string;
  status: string;
  shipping_label: string;
};

type OnlineOrderRow = {
  id: string;
  buyer_email?: string | null;
  buyer_name?: string | null;
  buyer_phone?: string | null;
  total_cents?: number | null;
  status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  channel?: string | null;
  created_at: string;
  shipping_address_line_1?: string | null;
  shipping_address_line_2?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_postal_code?: string | null;
  shipping_country?: string | null;
};

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildShippingLabel(row: OnlineOrderRow) {
  const line1 = row.shipping_address_line_1?.trim() ?? "";
  const line2 = row.shipping_address_line_2?.trim() ?? "";
  const city = row.shipping_city?.trim() ?? "";
  const state = row.shipping_state?.trim() ?? "";
  const postal = row.shipping_postal_code?.trim() ?? "";
  const country = row.shipping_country?.trim() ?? "";

  const lineA = [line1, line2].filter(Boolean).join(", ");
  const lineB = [city, state, postal].filter(Boolean).join(", ");
  const finalText = [lineA, lineB, country].filter(Boolean).join(" · ");

  return finalText || "No shipping address";
}

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase } = await requireOwnerPage();

  const params = await searchParams;
  const channel = typeof params.channel === "string" ? params.channel : "";

  const [onlineItemsResult, posResult] = await Promise.all([
    supabase.from("order_items").select("order_id,name_snapshot,qty"),
    supabase
      .from("pos_sales")
      .select("id,created_at,product_name,qty,total,payment_method,payment_reference,customer_email")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const onlineResultWithReference = await supabase
    .from("orders")
    .select(
      [
        "id",
        "buyer_email",
        "buyer_name",
        "buyer_phone",
        "total_cents",
        "status",
        "payment_status",
        "payment_method",
        "payment_reference",
        "channel",
        "created_at",
        "shipping_address_line_1",
        "shipping_address_line_2",
        "shipping_city",
        "shipping_state",
        "shipping_postal_code",
        "shipping_country",
      ].join(",")
    )
    .eq("status", "paid")
    .eq("payment_status", "paid")
    .eq("channel", "online")
    .order("created_at", { ascending: false })
    .limit(300);

  const onlineResult = onlineResultWithReference.error?.message?.includes(
    "column orders.payment_reference does not exist"
  )
    ? await supabase
        .from("orders")
        .select(
          [
            "id",
            "buyer_email",
            "buyer_name",
            "buyer_phone",
            "total_cents",
            "status",
            "payment_status",
            "payment_method",
            "channel",
            "created_at",
            "shipping_address_line_1",
            "shipping_address_line_2",
            "shipping_city",
            "shipping_state",
            "shipping_postal_code",
            "shipping_country",
          ].join(",")
        )
        .eq("status", "paid")
        .eq("payment_status", "paid")
        .eq("channel", "online")
        .order("created_at", { ascending: false })
        .limit(300)
    : onlineResultWithReference;

  const onlineRows: OnlineOrderRow[] = Array.isArray(onlineResult.data)
  ? (onlineResult.data as unknown as OnlineOrderRow[])
  : [];
  const posRows = Array.isArray(posResult.data) ? posResult.data : [];
const onlineItems = Array.isArray(onlineItemsResult.data)
  ? onlineItemsResult.data
  : [];

  const itemsByOrderId = new Map<string, Array<{ name_snapshot: string; qty: number }>>();
  for (const item of onlineItems) {
    const list = itemsByOrderId.get(item.order_id) ?? [];
    list.push({
      name_snapshot: item.name_snapshot,
      qty: Number(item.qty ?? 0),
    });
    itemsByOrderId.set(item.order_id, list);
  }

  const unifiedOnline: AdminSaleRow[] = onlineRows.map((row) => {
    const items = itemsByOrderId.get(row.id) ?? [];
    const quantity = items.reduce((sum, x) => sum + Number(x.qty ?? 0), 0);
    const productSummary =
      items.length > 0
        ? items
            .slice(0, 3)
            .map((x) => `${x.name_snapshot} ×${x.qty}`)
            .join(" · ")
        : "No items";

    return {
      id: row.id,
      created_at: row.created_at,
      channel: "online",
      customer: row.buyer_email ?? "—",
      customer_name: row.buyer_name ?? "—",
      customer_phone: row.buyer_phone ?? "—",
      product_summary: productSummary,
      quantity,
      total_cents: Number(row.total_cents ?? 0),
      payment_method: row.payment_method ?? "—",
      payment_reference: row.payment_reference ?? "—",
      status: `${row.status ?? "—"}/${row.payment_status ?? "—"}`,
      shipping_label: buildShippingLabel(row),
    };
  });

  const unifiedPos: AdminSaleRow[] = posRows.map((row) => ({
    id: row.id,
    created_at: row.created_at,
    channel: "physical_store",
    customer: row.customer_email ?? "—",
    customer_name: "Walk-in / POS",
    customer_phone: "—",
    product_summary: row.product_name
      ? `${row.product_name} ×${Number(row.qty ?? 0)}`
      : "—",
    quantity: Number(row.qty ?? 0),
    total_cents: Number(row.total ?? 0),
    payment_method: row.payment_method ?? "—",
    payment_reference: row.payment_reference ?? "—",
    status: "paid/paid",
    shipping_label: "Not applicable",
  }));

  const mergedRows = [...unifiedOnline, ...unifiedPos].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
  );

  const filteredRows = channel
    ? mergedRows.filter((row) => row.channel === channel)
    : mergedRows;

  return (
    <div className="space-y-5 rounded-2xl border border-uiBorder bg-surface p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Ventas (pagadas)</h1>
          <p className="mt-1 text-sm text-mutedText">
            Órdenes online y ventas POS con información útil para despacho y seguimiento.
          </p>
        </div>

        <form className="flex gap-2 text-sm">
          <select
            name="channel"
            defaultValue={channel}
            className="rounded-lg border border-uiBorder bg-white px-3 py-2"
          >
            <option value="">Todos los canales</option>
            <option value="online">Online</option>
            <option value="physical_store">POS / Tienda física</option>
          </select>
          <button className="btn-primary" type="submit">
            Filtrar
          </button>
        </form>
      </div>

      <div className="grid gap-4">
        {filteredRows.length === 0 && (
          <div className="rounded-xl border border-dashed border-uiBorder bg-white p-8 text-center text-sm text-mutedText">
            No hay ventas para este filtro.
          </div>
        )}

        {filteredRows.map((o) => (
          <article
            key={`${o.channel}-${o.id}`}
            className="rounded-xl border border-uiBorder bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-brand-ink">
                    {o.id}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {o.channel === "online" ? "Online" : "POS"}
                  </span>
                  <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                    {o.status}
                  </span>
                </div>

                <p className="text-xs text-mutedText">{formatDate(o.created_at)}</p>

                <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-slate-900">Cliente:</span>{" "}
                    {o.customer_name}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Email:</span>{" "}
                    {o.customer}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Teléfono:</span>{" "}
                    {o.customer_phone}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Pago:</span>{" "}
                    {o.payment_method} · Ref: {o.payment_reference}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-900">Productos</p>
                  <p className="mt-1 text-slate-700">{o.product_summary}</p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-900">Dirección de envío</p>
                  <p className="mt-1 text-slate-700">{o.shipping_label}</p>
                </div>
              </div>

              <div className="min-w-[140px] rounded-xl border border-uiBorder bg-slate-50 p-4 text-right">
                <p className="text-xs uppercase tracking-wide text-mutedText">
                  Total
                </p>
                <p className="mt-1 text-2xl font-bold text-brand-ink">
                  {formatMoney(o.total_cents)}
                </p>
                <p className="mt-1 text-sm text-mutedText">
                  Qty {o.quantity}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}