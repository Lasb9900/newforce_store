import "server-only";
import { getServerSupabase } from "@/lib/supabase";

export type PosSaleRow = {
  sale_id: string;
  order_id?: string | null;
  cash_closure_id?: string | null;
  created_at: string;
  product_name: string;
  item_number: string | null;
  qty: number;
  price_cents: number;
  total_cents: number;
  payment_method: "cash" | "card" | "transfer" | string | null;
  payment_reference: string | null;
  customer_email: string | null;
  loyalty_status?: string | null;
  loyalty_points?: number;
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

export async function fetchPosSalesRange(
  fromDateIso: string,
  toDateIso: string,
  paymentMethod?: string,
  productQuery?: string,
  saleIdQuery?: string,
  pendingOnly = false,
) {
  const service = await getServerSupabase();

  let selectColumns = "id,order_id,cash_closure_id,created_at,product_name,item_number,qty,price,total,payment_method,payment_reference,customer_email";

  const runQuery = async () => {
    let query = service
      .from("pos_sales")
      .select(selectColumns)
      .gte("created_at", fromDateIso)
      .lte("created_at", toDateIso)
      .order("created_at", { ascending: false });

    if (saleIdQuery?.trim()) {
      const id = saleIdQuery.trim();
      query = query.eq("id", id);
    }

    if (pendingOnly) {
      query = query.is("cash_closure_id", null);
    }

    return query;
  };

  let { data: posRows, error } = await runQuery();

  if (error?.message?.includes("column pos_sales.order_id does not exist")) {
    selectColumns = "id,cash_closure_id,created_at,product_name,item_number,qty,price,total,payment_method,payment_reference,customer_email";
    const fallback = await runQuery();
    posRows = fallback.data;
    error = fallback.error;
  }

  if (error?.message?.includes("column pos_sales.cash_closure_id does not exist")) {
    selectColumns = "id,created_at,product_name,item_number,qty,price,total,payment_method,payment_reference,customer_email";
    const fallback = await runQuery();
    posRows = fallback.data;
    error = fallback.error;
  }

  if (error) return { data: [] as PosSaleRow[], error };

  const rows: PosSaleRow[] = (posRows ?? []).map((row) => ({
    sale_id: row.id,
    order_id: row.order_id ?? null,
    cash_closure_id: row.cash_closure_id ?? null,
    created_at: row.created_at,
    product_name: row.product_name,
    item_number: row.item_number,
    qty: row.qty,
    price_cents: row.price,
    total_cents: row.total,
    payment_method: row.payment_method,
    payment_reference: row.payment_reference,
    customer_email: row.customer_email,
  }));

  const filtered = rows.filter((row) => {
    if (paymentMethod && row.payment_method !== paymentMethod) return false;
    if (productQuery && !row.product_name.toLowerCase().includes(productQuery.toLowerCase())) return false;
    if (saleIdQuery && !`${row.sale_id}`.toLowerCase().includes(saleIdQuery.toLowerCase())) return false;
    return true;
  });

  const orderIds = filtered.map((row) => row.order_id).filter((orderId): orderId is string => Boolean(orderId));
  if (orderIds.length) {
    const { data: loyaltyRows } = await service
      .from("loyalty_transactions")
      .select("source_id,status,points_delta")
      .eq("source_type", "pos_sale")
      .in("source_id", orderIds);

    const loyaltyByOrderId = new Map(
      (loyaltyRows ?? []).map((entry) => [String(entry.source_id), { status: entry.status, points: Number(entry.points_delta ?? 0) }]),
    );

    return {
      data: filtered.map((row) => {
        const loyalty = row.order_id ? loyaltyByOrderId.get(row.order_id) : null;
        return {
          ...row,
          loyalty_status: loyalty?.status ?? null,
          loyalty_points: loyalty?.points ?? 0,
        };
      }),
      error: null,
    };
  }

  return { data: filtered, error: null };
}
