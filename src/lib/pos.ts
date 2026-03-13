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
  customer_user_id?: string | null;
  loyalty_status?: string | null;
  loyalty_points?: number;
  loyalty_error?: string | null;
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

  let selectColumns = "id,order_id,cash_closure_id,created_at,product_name,item_number,qty,price,total,payment_method,payment_reference,customer_email,customer_user_id,loyalty_status,loyalty_points_awarded,loyalty_error";

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
    selectColumns = "id,cash_closure_id,created_at,product_name,item_number,qty,price,total,payment_method,payment_reference,customer_email,customer_user_id,loyalty_status,loyalty_points_awarded,loyalty_error";
    const fallback = await runQuery();
    posRows = fallback.data;
    error = fallback.error;
  }

  if (error?.message?.includes("column pos_sales.cash_closure_id does not exist")) {
    selectColumns = "id,created_at,product_name,item_number,qty,price,total,payment_method,payment_reference,customer_email,customer_user_id,loyalty_status,loyalty_points_awarded,loyalty_error";
    const fallback = await runQuery();
    posRows = fallback.data;
    error = fallback.error;
  }

  if (error?.message?.includes("column pos_sales.customer_user_id does not exist")) {
    selectColumns = "id,order_id,cash_closure_id,created_at,product_name,item_number,qty,price,total,payment_method,payment_reference,customer_email";
    const fallback = await runQuery();
    posRows = fallback.data;
    error = fallback.error;
  }

  if (error) return { data: [] as PosSaleRow[], error };

  const rows: PosSaleRow[] = (((posRows ?? []) as unknown) as Array<Record<string, unknown>>).map((row) => ({
    sale_id: String(row.id ?? ""),
    order_id: row.order_id ? String(row.order_id) : null,
    cash_closure_id: row.cash_closure_id ? String(row.cash_closure_id) : null,
    created_at: String(row.created_at ?? ""),
    product_name: String(row.product_name ?? ""),
    item_number: row.item_number ? String(row.item_number) : null,
    qty: Number(row.qty ?? 0),
    price_cents: Number(row.price ?? 0),
    total_cents: Number(row.total ?? 0),
    payment_method: row.payment_method ? String(row.payment_method) : null,
    payment_reference: row.payment_reference ? String(row.payment_reference) : null,
    customer_email: row.customer_email ? String(row.customer_email) : null,
    customer_user_id: row.customer_user_id ? String(row.customer_user_id) : null,
    loyalty_status: row.loyalty_status ? String(row.loyalty_status) : null,
    loyalty_points: Number(row.loyalty_points_awarded ?? 0),
    loyalty_error: row.loyalty_error ? String(row.loyalty_error) : null,
  }));

  const filtered = rows.filter((row) => {
    if (paymentMethod && row.payment_method !== paymentMethod) return false;
    if (productQuery && !row.product_name.toLowerCase().includes(productQuery.toLowerCase())) return false;
    if (saleIdQuery && !`${row.sale_id}`.toLowerCase().includes(saleIdQuery.toLowerCase())) return false;
    return true;
  });

  const orderIds = filtered.map((row) => row.order_id).filter((orderId): orderId is string => Boolean(orderId));
  if (orderIds.length) {
    const { data: loyaltyRows, error: loyaltyError } = await service
      .from("loyalty_transactions")
      .select("source_id,status,points_delta")
      .eq("source_type", "pos_sale")
      .in("source_id", orderIds);

    if (loyaltyError) {
      return {
        data: filtered.map((row) => ({
          ...row,
          loyalty_status: row.loyalty_status ?? null,
          loyalty_points: row.loyalty_points ?? 0,
          loyalty_error: row.loyalty_error ?? null,
        })),
        error: null,
      };
    }

    const loyaltyByOrderId = new Map(
      (loyaltyRows ?? []).map((entry) => [String(entry.source_id), { status: entry.status, points: Number(entry.points_delta ?? 0) }]),
    );

    return {
      data: filtered.map((row) => {
        const loyalty = row.order_id ? loyaltyByOrderId.get(row.order_id) : null;
        return {
          ...row,
          loyalty_status: row.loyalty_status ?? loyalty?.status ?? null,
          loyalty_points: row.loyalty_points ?? loyalty?.points ?? 0,
          loyalty_error: row.loyalty_error ?? null,
        };
      }),
      error: null,
    };
  }

  return { data: filtered, error: null };
}
