import Link from "next/link";
import { requireCustomerPage } from "@/lib/auth";

export default async function AccountPage() {
  const { supabase, user, profile } = await requireCustomerPage("/login?next=/account");

  const [{ data: orders }, { data: customerPointsRow }] = await Promise.all([
    supabase
      .from("orders")
      .select("id,created_at,total_cents,status,payment_status,channel")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("customer_points")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const currentPoints = Number(customerPointsRow?.balance ?? 0);
  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Usuario";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Mi cuenta</h1>

        <div className="flex flex-wrap gap-2">
          {profile?.role === "admin" ? (
            <>
              <Link
                href="/admin"
                className="rounded-md border border-uiBorder bg-surface px-4 py-2 text-sm hover:bg-surfaceMuted"
              >
                Panel admin
              </Link>

              <Link
                href="/pos"
                className="rounded-md border border-uiBorder bg-surface px-4 py-2 text-sm hover:bg-surfaceMuted"
              >
                Punto de venta
              </Link>
            </>
          ) : null}

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border border-uiBorder bg-surface px-4 py-2 text-sm hover:bg-surfaceMuted"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-mutedText">Perfil</p>
          <h2 className="mt-2 text-2xl font-semibold">{fullName}</h2>
          <p className="mt-2 text-lg">{user.email}</p>
          {profile?.phone ? <p className="text-lg">{profile.phone}</p> : null}
          {profile?.role ? (
            <p className="mt-2 text-sm uppercase text-mutedText">Rol: {profile.role}</p>
          ) : null}
        </article>

        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-mutedText">Puntos actuales</p>
          <p className="mt-2 text-5xl font-extrabold text-brand-secondary">{currentPoints}</p>
          <Link href="/account/points" className="mt-4 inline-block text-lg hover:underline">
            Ver movimientos
          </Link>
        </article>
      </div>

      <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Últimas compras</h2>
          <Link href="/account/orders" className="text-lg hover:underline">
            Ver todas
          </Link>
        </div>

        <ul className="space-y-3">
          {(orders ?? []).map((order) => (
            <li key={order.id} className="rounded-lg border border-uiBorder px-4 py-3">
              <p className="font-semibold">
                {new Date(order.created_at).toLocaleString()} · {order.channel}
              </p>
              <p className="text-mutedText">
                ${(Number(order.total_cents ?? 0) / 100).toFixed(2)} · {order.status}/
                {order.payment_status}
              </p>
            </li>
          ))}

          {(!orders || orders.length === 0) && (
            <li className="rounded-lg border border-uiBorder px-4 py-6 text-mutedText">
              Aún no tienes compras registradas.
            </li>
          )}
        </ul>
      </article>
    </div>
  );
}