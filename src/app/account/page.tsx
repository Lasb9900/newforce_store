import Link from "next/link";
import { requireCustomerPage } from "@/lib/auth";
import SignOutButton from "@/components/nav/SignOutButton";

type UnifiedPurchase = {
  id: string;
  created_at: string;
  channel: "online" | "physical_store";
  total_cents: number;
  status: string;
  payment_status: string;
};

export default async function AccountPage() {
  const { supabase, user, profile } = await requireCustomerPage("/login?next=/account");
  const normalizedProfileEmail = profile?.email?.trim().toLowerCase() ?? null;

  const [loyaltyResult, { data: onlineOrders }, posQueryByUser] = await Promise.all([
    supabase.from("loyalty_transactions").select("points_delta").eq("user_id", user.id).eq("status", "applied"),
    supabase
      .from("orders")
      .select("id,total_cents,status,payment_status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("pos_sales")
      .select("id,created_at,total,customer_user_id,customer_email")
      .eq("customer_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const loyaltyTx = loyaltyResult.error ? [] : loyaltyResult.data ?? [];

  let posSales: Array<Record<string, unknown>> = ((posQueryByUser.data ?? []) as unknown as Array<Record<string, unknown>>);

  if (posQueryByUser.error?.message?.includes("column pos_sales.customer_user_id does not exist") && normalizedProfileEmail) {
    const fallback = await supabase
      .from("pos_sales")
      .select("id,created_at,total,customer_email")
      .eq("customer_email", normalizedProfileEmail)
      .order("created_at", { ascending: false })
      .limit(8);
    posSales = ((fallback.data ?? []) as unknown as Array<Record<string, unknown>>);
  } else if (normalizedProfileEmail) {
    const fallback = await supabase
      .from("pos_sales")
      .select("id,created_at,total,customer_user_id,customer_email")
      .is("customer_user_id", null)
      .eq("customer_email", normalizedProfileEmail)
      .order("created_at", { ascending: false })
      .limit(8);

    const byEmail = ((fallback.data ?? []) as unknown as Array<Record<string, unknown>>);
    const known = new Set(posSales.map((row) => String(row.id ?? "")));
    posSales = [...posSales, ...byEmail.filter((row) => !known.has(String(row.id ?? "")))];
  }

  const purchases: UnifiedPurchase[] = [
    ...(onlineOrders ?? []).map((order) => ({
      id: String(order.id),
      created_at: String(order.created_at),
      channel: "online" as const,
      total_cents: Number(order.total_cents ?? 0),
      status: String(order.status ?? "paid"),
      payment_status: String(order.payment_status ?? "paid"),
    })),
    ...posSales.map((sale) => ({
      id: String(sale.id),
      created_at: String(sale.created_at),
      channel: "physical_store" as const,
      total_cents: Number(sale.total ?? 0),
      status: "paid",
      payment_status: "paid",
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const effectivePoints = (loyaltyTx ?? []).reduce((sum, row) => sum + Number(row.points_delta ?? 0), 0);
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user.email;
  const isAdmin = profile?.role === "admin" || profile?.role === "owner";
  const isSeller = profile?.role === "seller" || isAdmin;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <div className="flex items-center gap-2">
          {isAdmin ? <Link href="/admin" className="rounded border border-uiBorder bg-surface px-3 py-1.5 hover:bg-surfaceMuted">Panel admin</Link> : null}
          {isSeller ? <Link href="/pos" className="rounded border border-uiBorder bg-surface px-3 py-1.5 hover:bg-surfaceMuted">Punto de venta</Link> : null}
          <SignOutButton className="border border-uiBorder bg-surface hover:bg-surfaceMuted" redirectTo="/login">
            Cerrar sesión
          </SignOutButton>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <p className="text-xs uppercase text-mutedText">Perfil</p>
          <p className="mt-2 text-lg font-bold">{fullName}</p>
          <p className="text-sm text-mutedText">{profile?.email || user.email}</p>
          <p className="text-sm text-mutedText">{profile?.phone || "Sin teléfono"}</p>
          <p className="mt-1 text-xs uppercase text-mutedText">Rol: {profile?.role ?? "customer"}</p>
        </article>
        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <p className="text-xs uppercase text-mutedText">Puntos actuales</p>
          <p className="mt-2 text-3xl font-extrabold text-brand-secondary">{effectivePoints}</p>
          <Link href="/account/points" className="text-sm font-semibold text-brand-secondary hover:underline">Ver movimientos</Link>
        </article>
      </div>

      <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Últimas compras</h2>
          <Link href="/account/orders" className="text-sm font-semibold text-brand-secondary hover:underline">Ver todas</Link>
        </div>
        <ul className="space-y-2 text-sm">
          {purchases.map((entry) => (
            <li key={`${entry.channel}-${entry.id}`} className="rounded-md border border-uiBorder px-3 py-2">
              <p className="font-medium">{new Date(entry.created_at).toLocaleString()} · {entry.channel === "online" ? "online" : "physical_store"}</p>
              <p className="text-mutedText">${(entry.total_cents / 100).toFixed(2)} · {entry.status}/{entry.payment_status}</p>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}
