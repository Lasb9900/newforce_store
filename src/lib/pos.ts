import "server-only";
import { getServerSupabase } from "@/lib/supabase";

export type PosSaleRow = {
  sale_id: string;
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

export async function fetchPosSalesRange(fromDateIso: string, toDateIso: string, paymentMethod?: string, productQuery?: string, saleIdQuery?: string) {
  const service = await getServerSupabase();

  let query = service
    .from("pos_sales")
    .select("id,created_at,product_name,item_number,qty,price,total,payment_method,payment_reference,customer_email")
    .gte("created_at", fromDateIso)
    .lte("created_at", toDateIso)
    .order("created_at", { ascending: false });

  if (saleIdQuery?.trim()) {
    const id = saleIdQuery.trim();
    query = query.eq("id", id);
  }

  const { data: posRows, error } = await query;

  if (error) return { data: [] as PosSaleRow[], error };

  const rows: PosSaleRow[] = (posRows ?? []).map((row) => ({
    sale_id: row.id,
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

  return { data: filtered, error: null };
}
