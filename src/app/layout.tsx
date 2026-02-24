import "./globals.css";
import Link from "next/link";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-6xl items-center justify-between p-4">
            <Link href="/" className="font-bold text-slate-900">
              NewForce Store
            </Link>
            <div className="flex gap-4 text-sm text-slate-700">
              <Link href="/shop">Shop</Link>
              <Link href="/wishlist">Wishlist</Link>
              <Link href="/cart">Carrito</Link>
              <Link href="/admin/login">Admin</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl p-4">{children}</main>
      </body>
    </html>
  );
}
