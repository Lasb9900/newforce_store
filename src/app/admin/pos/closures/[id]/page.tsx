import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";

function toMoney(cents: number) {
  return new Intl.NumberFormat("es-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function AdminPosClosureDetail({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdminPage();
  const { id } = await params;

  const { data: closure } = await supabase.from("pos_cash_closures").select("*").eq("id", id).maybeSingle();
  if (!closure) notFound();

  const salesWithRef = await supabase
    .from("pos_cash_closure_sales")
    .select("sale_order_id,orders!inner(id,created_at,payment_method,payment_reference,buyer_email,total_cents,order_items(name_snapshot,qty,unit_price_cents_snapshot,line_total_cents))")
    .eq("closure_id", id);

  const salesResult = salesWithRef.error?.message?.includes("column orders.payment_reference does not exist")
    ? await supabase
        .from("pos_cash_closure_sales")
        .select("sale_order_id,orders!inner(id,created_at,payment_method,buyer_email,total_cents,order_items(name_snapshot,qty,unit_price_cents_snapshot,line_total_cents))")
        .eq("closure_id", id)
    : salesWithRef;

  const sales = salesResult.data;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Detalle cierre {closure.id}</h1>
      <div className="grid gap-2 rounded-xl border border-uiBorder bg-surface p-4 text-sm md:grid-cols-3">
        <p>Esperado efectivo: <strong>{toMoney(closure.expected_cash)}</strong></p>
        <p>Esperado tarjeta: <strong>{toMoney(closure.expected_card)}</strong></p>
        <p>Esperado transferencia: <strong>{toMoney(closure.expected_transfer)}</strong></p>
        <p>Real efectivo: <strong>{toMoney(closure.actual_cash)}</strong></p>
        <p>Real tarjeta: <strong>{toMoney(closure.actual_card)}</strong></p>
        <p>Real transferencia: <strong>{toMoney(closure.actual_transfer)}</strong></p>
      </div>

      <div className="space-y-2">
        {(sales ?? []).map((row) => {
          const order = row.orders[0] as { id: string; created_at: string; payment_method?: string | null; payment_reference?: string | null; buyer_email?: string | null; order_items: Array<{ name_snapshot: string; qty: number; unit_price_cents_snapshot: number; line_total_cents: number }> };
          if (!order) return null;
          return (
            <article key={row.sale_order_id} className="rounded-xl border border-uiBorder bg-surface p-3 text-sm">
              <p className="font-semibold">Venta {order.id} · {new Date(order.created_at).toLocaleString()}</p>
              <p>Método: {order.payment_method ?? "—"} · Ref: {order.payment_reference ?? "—"} · Email: {order.buyer_email ?? "—"}</p>
              <ul className="mt-2 list-disc pl-5">
                {order.order_items.map((item) => (
                  <li key={`${row.sale_order_id}-${item.name_snapshot}`}>{item.name_snapshot} · {item.qty} × {toMoney(item.unit_price_cents_snapshot)} = {toMoney(item.line_total_cents)}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}
