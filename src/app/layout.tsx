import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import { AuthNavControls } from "@/components/nav/AuthNavControls";

export const metadata: Metadata = {
  title: "Newforce Store | Retail Electronics & Home",
  description: "Shop premium home and tech products with trusted shipping, secure checkout and easy returns.",
};

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${poppins.className} min-h-screen bg-surfaceMuted text-brand-ink`}>
        <div className="border-b border-brand-primary/20 bg-brand-primary py-2 text-center text-xs font-medium text-white">
          Free shipping over $99 • 30-day returns • Secure checkout
        </div>
        <header className="sticky top-0 z-40 border-b border-uiBorder bg-white/95 backdrop-blur">
          <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 text-sm md:flex-nowrap md:gap-4">
            <Link href="/" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
              <Image src="/brand/cta-logo.svg" alt="Newforce Store" width={208} height={42} priority className="h-10 w-auto" />
            </Link>

            <form action="/shop" className="order-3 w-full md:order-none md:flex-1">
              <input
                name="q"
                placeholder="Search products, brands, SKU"
                className="w-full rounded-lg border border-uiBorder bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </form>

            <div className="ml-auto flex items-center gap-1 font-medium text-brand-ink">
              <Link href="/" className="rounded px-3 py-2 hover:bg-slate-100">Home</Link>
              <Link href="/shop" className="rounded px-3 py-2 hover:bg-slate-100">Shop</Link>
              <AuthNavControls />
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
