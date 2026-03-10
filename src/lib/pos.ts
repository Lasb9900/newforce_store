import "server-only";
import { getServiceSupabase } from "@/lib/supabase";

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

export async function fetchPosSalesRange(fromDateIso: string, toDateIso: string) {
  const service = getServiceSupabase();
  return service
    .from("pos_sales")
    .select("order_id,created_at,product_name,item_number,qty,price_cents,total_cents,payment_method,payment_reference,customer_email")
    .gte("created_at", fromDateIso)
    .lte("created_at", toDateIso)
    .order("created_at", { ascending: false });
}
