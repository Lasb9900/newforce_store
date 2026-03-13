import { requireAdminPage } from "@/lib/auth";
import { fetchPosSalesRange } from "@/lib/pos";

function toMoney(cents: number) {
  return new Intl.NumberFormat("es-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatLoyaltyStatus(status: string | null | undefined, points: number | null | undefined, hasEmail: boolean) {
  switch (status) {
    case "applied":
      return `Aplicado (+${points ?? 0})`;
    case "duplicate":
      return "Duplicado (idempotente)";
    case "skipped_no_user":
      return "Sin cuenta asociada";
    case "skipped_no_email":
      return "Sin email";
    case "skipped_ineligible":
      return "No elegible";
    case "pending":
      return "Pendiente";
    case "error":
      return "Error";
    default:
      return hasEmail ? "Sin procesar" : "Sin email";
  }
}

export default async function AdminPosSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const params = await searchParams;

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const from = typeof params.from === "string" ? params.from : sevenDaysAgo.toISOString().slice(0, 10);
  const to = typeof params.to === "string" ? params.to : now.toISOString().slice(0, 10);
  const paymentMethod = typeof params.paymentMethod === "string" ? params.paymentMethod : "";
  const product = typeof params.product === "string" ? params.product : "";
  const orderId = typeof params.orderId === "string" ? params.orderId : "";

  const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();

  const { data: sales, error } = await fetchPosSalesRange(fromIso, toIso, paymentMethod || undefined, product || undefined, orderId || undefined);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ventas POS</h1>
      <form className="grid gap-2 rounded-xl border border-uiBorder bg-surface p-4 md:grid-cols-6">
        <input type="date" name="from" defaultValue={from} className="rounded border border-uiBorder p-2" />
        <input type="date" name="to" defaultValue={to} className="rounded border border-uiBorder p-2" />
        <select name="paymentMethod" defaultValue={paymentMethod} className="rounded border border-uiBorder p-2">
          <option value="">Todos los métodos</option>
          <option value="cash">Efectivo</option>
          <option value="card">Tarjeta</option>
          <option value="transfer">Transferencia</option>
        </select>
        <input type="text" name="product" defaultValue={product} placeholder="Producto" className="rounded border border-uiBorder p-2" />
        <input type="text" name="orderId" defaultValue={orderId} placeholder="Order ID / Sale ID" className="rounded border border-uiBorder p-2" />
        <button className="btn-primary" type="submit">Filtrar</button>
      </form>

      {error ? <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">Error cargando ventas POS: {error.message}</p> : null}
      {!sales?.length ? <p className="rounded border border-uiBorder bg-surface p-4 text-sm">Sin ventas en el período.</p> : null}

      {sales?.length ? (
        <div className="overflow-x-auto rounded-xl border border-uiBorder bg-surface">
          <table className="min-w-full text-sm">
            <thead className="bg-surfaceMuted text-left">
              <tr>
                <th className="p-2">Fecha</th><th className="p-2">Order ID</th><th className="p-2">Producto</th><th className="p-2">Item #</th><th className="p-2">Cantidad</th><th className="p-2">Precio</th><th className="p-2">Total</th><th className="p-2">Método</th><th className="p-2">Referencia</th><th className="p-2">Email</th><th className="p-2">Fidelidad</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={`${s.sale_id}-${s.product_name}-${s.created_at}`} className="border-t border-uiBorder">
                  <td className="p-2">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="p-2 font-mono text-xs">{s.order_id ?? s.sale_id}</td>
                  <td className="p-2">{s.product_name}</td>
                  <td className="p-2">{s.item_number ?? "—"}</td>
                  <td className="p-2">{s.qty}</td>
                  <td className="p-2">{toMoney(s.price_cents)}</td>
                  <td className="p-2">{toMoney(s.total_cents)}</td>
                  <td className="p-2">{s.payment_method ?? "—"}</td>
                  <td className="p-2">{s.payment_reference ?? "—"}</td>
                  <td className="p-2">{s.customer_email ?? "—"}</td>
                  <td className="p-2">{formatLoyaltyStatus(s.loyalty_status, s.loyalty_points, Boolean(s.customer_email))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
