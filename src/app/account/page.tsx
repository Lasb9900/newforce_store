import Link from "next/link";
import { requireCustomerPage } from "@/lib/auth";
import SignOutButton from "@/components/nav/SignOutButton";

export default async function AccountPage() {
  const { supabase, user, profile } = await requireCustomerPage("/login?next=/account");

  const { data: points } = await supabase.from("customer_points").select("balance").eq("user_id", user.id).maybeSingle();
  const { data: orders } = await supabase
    .from("orders")
    .select("id,total_cents,status,channel,payment_status,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user.email;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <SignOutButton className="border border-uiBorder bg-surface hover:bg-surfaceMuted">Cerrar sesión</SignOutButton>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <p className="text-xs uppercase text-mutedText">Perfil</p>
          <p className="mt-2 text-lg font-bold">{fullName}</p>
          <p className="text-sm text-mutedText">{profile?.email || user.email}</p>
          <p className="text-sm text-mutedText">{profile?.phone || "Sin teléfono"}</p>
        </article>
        <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
          <p className="text-xs uppercase text-mutedText">Puntos actuales</p>
          <p className="mt-2 text-3xl font-extrabold text-brand-secondary">{points?.balance ?? 0}</p>
          <Link href="/account/points" className="text-sm font-semibold text-brand-secondary hover:underline">Ver movimientos</Link>
        </article>
      </div>
      <article className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Últimas compras</h2>
          <Link href="/account/orders" className="text-sm font-semibold text-brand-secondary hover:underline">Ver todas</Link>
        </div>
        <ul className="space-y-2 text-sm">
          {(orders ?? []).map((order) => (
            <li key={order.id} className="rounded-md border border-uiBorder px-3 py-2">
              <p className="font-medium">{new Date(order.created_at).toLocaleString()} · {(order.channel ?? "online")}</p>
              <p className="text-mutedText">${(order.total_cents / 100).toFixed(2)} · {order.status}/{order.payment_status}</p>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}
