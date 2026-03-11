import { requireAdminPage } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

function toMoney(cents: number) {
  return new Intl.NumberFormat("es-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function AdminPosSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const service = getServiceSupabase();

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const from = typeof params.from === "string" ? params.from : sevenDaysAgo.toISOString().slice(0, 10);
  const to = typeof params.to === "string" ? params.to : now.toISOString().slice(0, 10);
  const paymentMethod = typeof params.paymentMethod === "string" ? params.paymentMethod : "";
  const product = typeof params.product === "string" ? params.product : "";

  const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();

  let query = service
    .from("pos_sales_report")
    .select("id,order_id,created_at,product_name,item_number,qty,price_cents:price,total_cents:total,payment_method,payment_reference,customer_email")
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: false })
    .limit(500);

  if (paymentMethod) query = query.eq("payment_method", paymentMethod);
  if (product) query = query.ilike("product_name", `%${product}%`);

  const { data: sales } = await query;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ventas POS</h1>
      <form className="grid gap-2 rounded-xl border border-uiBorder bg-surface p-4 md:grid-cols-5">
        <input type="date" name="from" defaultValue={from} className="rounded border border-uiBorder p-2" />
        <input type="date" name="to" defaultValue={to} className="rounded border border-uiBorder p-2" />
        <select name="paymentMethod" defaultValue={paymentMethod} className="rounded border border-uiBorder p-2">
          <option value="">Todos los métodos</option>
          <option value="cash">Efectivo</option>
          <option value="card">Tarjeta</option>
          <option value="transfer">Transferencia</option>
        </select>
        <input type="text" name="product" defaultValue={product} placeholder="Producto" className="rounded border border-uiBorder p-2" />
        <button className="btn-primary" type="submit">Filtrar</button>
      </form>

      {!sales?.length ? <p className="rounded border border-uiBorder bg-surface p-4 text-sm">Sin ventas en el período.</p> : null}

      {sales?.length ? (
        <div className="overflow-x-auto rounded-xl border border-uiBorder bg-surface">
          <table className="min-w-full text-sm">
            <thead className="bg-surfaceMuted text-left">
              <tr>
                <th className="p-2">Fecha</th><th className="p-2">Producto</th><th className="p-2">Item #</th><th className="p-2">Cantidad</th><th className="p-2">Precio</th><th className="p-2">Total</th><th className="p-2">Método</th><th className="p-2">Referencia</th><th className="p-2">Email</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-t border-uiBorder">
                  <td className="p-2">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="p-2">{s.product_name}</td>
                  <td className="p-2">{s.item_number ?? "—"}</td>
                  <td className="p-2">{s.qty}</td>
                  <td className="p-2">{toMoney(s.price_cents)}</td>
                  <td className="p-2">{toMoney(s.total_cents)}</td>
                  <td className="p-2">{s.payment_method ?? "—"}</td>
                  <td className="p-2">{s.payment_reference ?? "—"}</td>
                  <td className="p-2">{s.customer_email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
