import "server-only";
import { getServerSupabase } from "@/lib/supabase";

export type PosSaleRow = {
  sale_id: string;
  legacy_order_id?: string | null;
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
  const trimmedSaleQuery = saleIdQuery?.trim() ?? "";
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmedSaleQuery);

  const baseColumns = [
    "id",
    "created_at",
    "product_name",
    "item_number",
    "qty",
    "price",
    "total",
    "payment_method",
    "payment_reference",
    "customer_email",
  ];

  const optionalColumns = {
    cash_closure_id: true,
    customer_user_id: true,
    loyalty_status: true,
    loyalty_points_awarded: true,
    loyalty_error: true,
    order_id: true,
  };

  const buildSelectColumns = () => [
    ...baseColumns,
    ...(optionalColumns.cash_closure_id ? ["cash_closure_id"] : []),
    ...(optionalColumns.customer_user_id ? ["customer_user_id"] : []),
    ...(optionalColumns.loyalty_status ? ["loyalty_status"] : []),
    ...(optionalColumns.loyalty_points_awarded ? ["loyalty_points_awarded"] : []),
    ...(optionalColumns.loyalty_error ? ["loyalty_error"] : []),
    ...(optionalColumns.order_id ? ["order_id"] : []),
  ].join(",");

  let posRows: Array<Record<string, unknown>> = [];
  let queryError: { message?: string } | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    let query = service
      .from("pos_sales")
      .select(buildSelectColumns())
      .gte("created_at", fromDateIso)
      .lte("created_at", toDateIso)
      .order("created_at", { ascending: false });

    if (pendingOnly && optionalColumns.cash_closure_id) {
      query = query.is("cash_closure_id", null);
    }

    if (looksLikeUuid) {
      query = query.eq("id", trimmedSaleQuery);
    }

    const result = await query;
    if (!result.error) {
      posRows = ((result.data ?? []) as unknown as Array<Record<string, unknown>>);
      queryError = null;
      break;
    }

    queryError = { message: result.error.message };
    const msg = result.error.message ?? "";

    if (msg.includes("column pos_sales.cash_closure_id does not exist")) {
      optionalColumns.cash_closure_id = false;
      continue;
    }
    if (msg.includes("column pos_sales.customer_user_id does not exist")) {
      optionalColumns.customer_user_id = false;
      continue;
    }
    if (msg.includes("column pos_sales.loyalty_status does not exist")) {
      optionalColumns.loyalty_status = false;
      continue;
    }
    if (msg.includes("column pos_sales.loyalty_points_awarded does not exist")) {
      optionalColumns.loyalty_points_awarded = false;
      continue;
    }
    if (msg.includes("column pos_sales.loyalty_error does not exist")) {
      optionalColumns.loyalty_error = false;
      continue;
    }
    if (msg.includes("column pos_sales.order_id does not exist")) {
      optionalColumns.order_id = false;
      continue;
    }

    break;
  }

  if (queryError) return { data: [] as PosSaleRow[], error: queryError as Error };

  const rows: PosSaleRow[] = posRows.map((row) => ({
    sale_id: String(row.id ?? ""),
    legacy_order_id: row.order_id ? String(row.order_id) : null,
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
    if (saleIdQuery) {
      const q = saleIdQuery.toLowerCase();
      const bySaleId = row.sale_id.toLowerCase().includes(q);
      const byLegacyOrderId = (row.legacy_order_id ?? "").toLowerCase().includes(q);
      if (!bySaleId && !byLegacyOrderId) return false;
    }
    if (pendingOnly && optionalColumns.cash_closure_id && row.cash_closure_id) return false;
    return true;
  });

  const saleIds = filtered.map((row) => row.sale_id).filter(Boolean);
  if (!saleIds.length) {
    return { data: filtered, error: null };
  }

  const { data: loyaltyRows } = await service
    .from("loyalty_transactions")
    .select("source_id,status,points_delta")
    .eq("source_type", "pos_sale")
    .in("source_id", saleIds);

  const loyaltyBySaleId = new Map(
    (loyaltyRows ?? []).map((entry) => [String(entry.source_id), { status: String(entry.status), points: Number(entry.points_delta ?? 0) }]),
  );

  return {
    data: filtered.map((row) => {
      const loyalty = loyaltyBySaleId.get(row.sale_id);
      return {
        ...row,
        loyalty_status: row.loyalty_status ?? loyalty?.status ?? null,
        loyalty_points: Number(row.loyalty_points ?? loyalty?.points ?? 0),
      };
    }),
    error: null,
  };
}
