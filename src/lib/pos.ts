import "server-only";
import { getServerSupabase } from "@/lib/supabase";

export type PosSaleRow = {
  order_id: string;
  created_at: string;
  product_name: string;
  item_number: string | null;
  qty: number;
  price_cents: number;
  total_cents: number;
  payment_method: "cash" | "card" | "transfer" | string | null;
  payment_reference: string | null;
  customer_email: string | null;
};

export type PosTotals = {
  totalSalesCents: number;
  cashCents: number;
  cardCents: number;
  transferCents: number;
};

export function sumPosTotals(rows: PosSaleRow[]): PosTotals {
  return rows.reduce(
    (acc, row) => {
      acc.totalSalesCents += row.total_cents ?? 0;
      if (row.payment_method === "cash") acc.cashCents += row.total_cents ?? 0;
      if (row.payment_method === "card") acc.cardCents += row.total_cents ?? 0;
      if (row.payment_method === "transfer") acc.transferCents += row.total_cents ?? 0;
      return acc;
    },
    { totalSalesCents: 0, cashCents: 0, cardCents: 0, transferCents: 0 },
  );
}

export async function fetchPosSalesRange(fromDateIso: string, toDateIso: string, paymentMethod?: string, productQuery?: string, orderIdQuery?: string) {
  const service = await getServerSupabase();

  if (orderIdQuery?.trim()) {
    const { data: byId, error: byIdError } = await service
      .from("orders")
      .select("id,created_at,payment_method,payment_reference,buyer_email,channel,status,payment_status,order_items(product_id,name_snapshot,qty,unit_price_cents_snapshot,line_total_cents)")
      .eq("id", orderIdQuery.trim())
      .eq("channel", "physical_store")
      .eq("status", "paid")
      .eq("payment_status", "paid")
      .maybeSingle();

    if (byIdError) return { data: [] as PosSaleRow[], error: byIdError };
    if (!byId) return { data: [] as PosSaleRow[], error: null };

    const rows: PosSaleRow[] = (byId.order_items ?? []).map((item) => ({
      order_id: byId.id,
      created_at: byId.created_at,
      product_name: item.name_snapshot,
      item_number: null,
      qty: item.qty,
      price_cents: item.unit_price_cents_snapshot,
      total_cents: item.line_total_cents ?? item.unit_price_cents_snapshot * item.qty,
      payment_method: byId.payment_method,
      payment_reference: byId.payment_reference,
      customer_email: byId.buyer_email,
    }));

    return { data: rows, error: null };
  }

  const { data: ordersWithRef, error: errorWithRef } = await service
    .from("orders")
    .select("id,created_at,payment_method,payment_reference,buyer_email,order_items(product_id,name_snapshot,qty,unit_price_cents_snapshot,line_total_cents)")
    .eq("channel", "physical_store")
    .eq("status", "paid")
    .eq("payment_status", "paid")
    .gte("created_at", fromDateIso)
    .lte("created_at", toDateIso)
    .order("created_at", { ascending: false });

  let orders = ordersWithRef;
  let error = errorWithRef;

  if (error?.message?.includes("column orders.payment_reference does not exist")) {
    const fallback = await service
      .from("orders")
      .select("id,created_at,payment_method,buyer_email,order_items(product_id,name_snapshot,qty,unit_price_cents_snapshot,line_total_cents)")
      .eq("channel", "physical_store")
      .eq("status", "paid")
      .eq("payment_status", "paid")
      .gte("created_at", fromDateIso)
      .lte("created_at", toDateIso)
      .order("created_at", { ascending: false });

    orders = fallback.data as typeof ordersWithRef;
    error = fallback.error;
  }

  if (error) return { data: [] as PosSaleRow[], error };

  const rows: PosSaleRow[] = [];
  for (const order of orders ?? []) {
    for (const item of order.order_items ?? []) {
      rows.push({
        order_id: order.id,
        created_at: order.created_at,
        product_name: item.name_snapshot,
        item_number: null,
        qty: item.qty,
        price_cents: item.unit_price_cents_snapshot,
        total_cents: item.line_total_cents ?? item.unit_price_cents_snapshot * item.qty,
        payment_method: order.payment_method,
        payment_reference: order.payment_reference,
        customer_email: order.buyer_email,
      });
    }
  }

  const filtered = rows.filter((row) => {
    if (paymentMethod && row.payment_method !== paymentMethod) return false;
    if (productQuery && !row.product_name.toLowerCase().includes(productQuery.toLowerCase())) return false;
    if (orderIdQuery && !row.order_id.toLowerCase().includes(orderIdQuery.toLowerCase())) return false;
    return true;
  });

  return { data: filtered, error: null };
}
