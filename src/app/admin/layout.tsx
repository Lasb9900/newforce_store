import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <aside className="rounded border bg-white p-3">
        <h2 className="mb-2 font-bold">Admin</h2>
        <nav className="space-y-2 text-sm">
          <Link href="/admin">Dashboard</Link><br/>
          <Link href="/admin/products">Productos</Link><br/>
          <Link href="/admin/orders">Órdenes</Link><br/>
          <Link href="/admin/reviews">Reviews</Link>
        </nav>
      </aside>
      <section>{children}</section>
    </div>
  );
}
