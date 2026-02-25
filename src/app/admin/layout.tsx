import Image from "next/image";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <header className="rounded-xl bg-brand-secondary px-4 py-3 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/brand/cta-isotipo.svg" alt="CTA Isotipo" width={28} height={28} className="h-7 w-7" />
            <p className="font-semibold">Close to Amazon · Admin</p>
          </div>
          <Link href="/" className="text-sm text-white/90 hover:underline">Volver a tienda</Link>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        <aside className="rounded-xl bg-brand-secondary p-4 text-white">
          <h2 className="mb-3 text-lg font-bold">Panel</h2>
          <nav className="space-y-1 text-sm">
            <Link href="/admin" className="block rounded px-2 py-2 hover:bg-white/10">Dashboard</Link>
            <Link href="/admin/products" className="block rounded px-2 py-2 hover:bg-white/10">Productos</Link>
            <Link href="/admin/orders" className="block rounded px-2 py-2 hover:bg-white/10">Órdenes</Link>
            <Link href="/admin/reviews" className="block rounded px-2 py-2 hover:bg-white/10">Reviews</Link>
          </nav>
        </aside>
        <section>{children}</section>
      </div>
    </div>
  );
}
