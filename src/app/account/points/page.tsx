import { requireCustomerPage } from "@/lib/auth";
import RedeemPointsForm from "./redeem-points-form";

export default async function AccountPointsPage() {
  const { supabase, user } = await requireCustomerPage("/login?next=/account/points");

  const [{ data: loyaltyTx }, { data: ledger }, { data: redeemableProducts }] = await Promise.all([
    supabase
      .from("loyalty_transactions")
      .select("id,source_type,source_id,points_delta,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("points_ledger")
      .select("id,type,points_delta,description,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("products").select("id,name,points_price,base_stock").eq("redeemable", true).gt("base_stock", 0).order("name"),
  ]);

  const effectivePoints = (loyaltyTx ?? [])
    .filter((tx) => tx.status === "applied")
    .reduce((sum, tx) => sum + Number(tx.points_delta ?? 0), 0);

  return (
    <div className="space-y-4">
      <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
        <h1 className="text-2xl font-bold">Mis puntos</h1>
        <p className="mt-2 text-3xl font-extrabold text-brand-secondary">{effectivePoints}</p>
      </article>

      <RedeemPointsForm products={redeemableProducts ?? []} />

      <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Movimientos (ledger)</h2>
        <ul className="space-y-2 text-sm">
          {(ledger ?? []).map((entry) => (
            <li key={entry.id} className="rounded-md border border-uiBorder px-3 py-2">
              <p className="font-semibold">{entry.type} · {entry.points_delta > 0 ? "+" : ""}{entry.points_delta}</p>
              <p className="text-mutedText">{entry.description || "Sin descripción"} · {new Date(entry.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </article>

      <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Movimientos de fidelidad (auditoría)</h2>
        <ul className="space-y-2 text-sm">
          {(loyaltyTx ?? []).map((tx) => (
            <li key={tx.id} className="rounded-md border border-uiBorder px-3 py-2">
              <p className="font-semibold">{tx.source_type} · {tx.status} · {tx.points_delta > 0 ? "+" : ""}{tx.points_delta}</p>
              <p className="text-mutedText">source_id: {tx.source_id} · {new Date(tx.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}
