import Image from "next/image";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-2xl border border-slate-200 bg-brand-secondary px-5 py-4 text-white shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/brand/cta-isotipo.svg"
                alt="CTA Isotipo"
                width={32}
                height={32}
                className="h-8 w-8 rounded-md bg-white/10 p-1"
              />
              <div>
                <p className="text-sm text-white/70">Backoffice</p>
                <p className="text-lg font-semibold">Close to Amazon · Admin</p>
              </div>
            </div>

            <Link
              href="/"
              className="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              Volver a tienda
            </Link>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-brand-secondary p-5 text-white shadow-sm">
            <h2 className="mb-4 text-xl font-bold">Panel</h2>

            <nav className="space-y-1.5 text-sm">
              <Link href="/admin" className="block rounded-xl px-3 py-2.5 transition hover:bg-white/10">
                Dashboard
              </Link>
              <Link href="/admin/products" className="block rounded-xl px-3 py-2.5 transition hover:bg-white/10">
                Productos
              </Link>
              <Link href="/admin/orders" className="block rounded-xl px-3 py-2.5 transition hover:bg-white/10">
                Órdenes
              </Link>
              <Link href="/admin/reviews" className="block rounded-xl px-3 py-2.5 transition hover:bg-white/10">
                Reviews
              </Link>
              <Link href="/pos" className="block rounded-xl px-3 py-2.5 transition hover:bg-white/10">
                POS / Tienda física
              </Link>
              <Link href="/admin/pos/sales" className="block rounded-xl px-3 py-2.5 transition hover:bg-white/10">
                POS · Ventas
              </Link>
              <Link href="/admin/pos/closure" className="block rounded-xl px-3 py-2.5 transition hover:bg-white/10">
                POS · Cierre de caja
              </Link>
              <Link href="/admin/pos/closures" className="block rounded-xl px-3 py-2.5 transition hover:bg-white/10">
                POS · Historial cierres
              </Link>
              <Link href="/account" className="block rounded-xl px-3 py-2.5 transition hover:bg-white/10">
                Cuenta cliente
              </Link>
            </nav>
          </aside>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}