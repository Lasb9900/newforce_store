import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";

function toMoney(cents: number) {
  return new Intl.NumberFormat("es-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function AdminPosClosuresPage() {
  const { supabase } = await requireAdminPage();

  const { data } = await supabase
    .from("pos_cash_closures")
    .select("id,closed_at,closed_by,expected_cash,expected_card,expected_transfer,actual_cash,actual_card,actual_transfer,cash_difference,card_difference,transfer_difference")
    .order("closed_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Historial de cierres POS</h1>
      <div className="rounded-xl border border-uiBorder bg-surface p-2">
        <table className="min-w-full text-sm">
          <thead className="text-left"><tr><th className="p-2">Fecha cierre</th><th className="p-2">Total esperado</th><th className="p-2">Total real</th><th className="p-2">Diferencia</th><th className="p-2">Detalle</th></tr></thead>
          <tbody>
            {(data ?? []).map((c) => {
              const expected = c.expected_cash + c.expected_card + c.expected_transfer;
              const actual = c.actual_cash + c.actual_card + c.actual_transfer;
              const diff = c.cash_difference + c.card_difference + c.transfer_difference;
              return (
                <tr key={c.id} className="border-t border-uiBorder">
                  <td className="p-2">{new Date(c.closed_at).toLocaleString()}</td>
                  <td className="p-2">{toMoney(expected)}</td>
                  <td className="p-2">{toMoney(actual)}</td>
                  <td className="p-2">{toMoney(diff)}</td>
                  <td className="p-2"><Link className="text-brand-primary hover:underline" href={`/admin/pos/closures/${c.id}`}>Ver</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
