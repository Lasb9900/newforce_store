import { requireAdminPage } from "@/lib/auth";
import { fetchPosSalesRange, sumPosTotals } from "@/lib/pos";
import ClosureForm from "./closure-form";

function toMoney(cents: number) {
  return new Intl.NumberFormat("es-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function AdminPosClosurePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const params = await searchParams;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const from = typeof params.from === "string" ? params.from : today;
  const to = typeof params.to === "string" ? params.to : today;

  const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();

  const { data } = await fetchPosSalesRange(fromIso, toIso);
  const sales = data ?? [];
  const totals = sumPosTotals(sales);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cierre de caja POS</h1>

      <form className="grid gap-2 rounded-xl border border-uiBorder bg-surface p-4 md:grid-cols-3">
        <input type="date" name="from" defaultValue={from} className="rounded border border-uiBorder p-2" />
        <input type="date" name="to" defaultValue={to} className="rounded border border-uiBorder p-2" />
        <button type="submit" className="btn-primary">Actualizar período</button>
      </form>

      <div className="grid gap-3 md:grid-cols-4">
        <article className="rounded border border-uiBorder bg-surface p-3"><p className="text-xs text-mutedText">Total ventas</p><p className="text-xl font-bold">{toMoney(totals.totalSalesCents)}</p></article>
        <article className="rounded border border-uiBorder bg-surface p-3"><p className="text-xs text-mutedText">Efectivo</p><p className="text-xl font-bold">{toMoney(totals.cashCents)}</p></article>
        <article className="rounded border border-uiBorder bg-surface p-3"><p className="text-xs text-mutedText">Tarjeta</p><p className="text-xl font-bold">{toMoney(totals.cardCents)}</p></article>
        <article className="rounded border border-uiBorder bg-surface p-3"><p className="text-xs text-mutedText">Transferencia</p><p className="text-xl font-bold">{toMoney(totals.transferCents)}</p></article>
      </div>

      {!sales.length ? <p className="rounded border border-uiBorder bg-surface p-4 text-sm">Sin ventas para el período seleccionado.</p> : null}
      {sales.length ? (
        <div className="overflow-x-auto rounded-xl border border-uiBorder bg-surface">
          <table className="min-w-full text-sm">
            <thead className="bg-surfaceMuted text-left"><tr><th className="p-2">Fecha</th><th className="p-2">Producto</th><th className="p-2">Método</th><th className="p-2">Referencia</th><th className="p-2">Total</th></tr></thead>
            <tbody>
              {sales.map((s) => (
                <tr key={`${s.order_id}-${s.created_at}`} className="border-t border-uiBorder"><td className="p-2">{new Date(s.created_at).toLocaleString()}</td><td className="p-2">{s.product_name}</td><td className="p-2">{s.payment_method}</td><td className="p-2">{s.payment_reference ?? "—"}</td><td className="p-2">{toMoney(s.total_cents)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ClosureForm
        from={from}
        to={to}
        expectedCashCents={totals.cashCents}
        expectedCardCents={totals.cardCents}
        expectedTransferCents={totals.transferCents}
      />
    </div>
  );
}
