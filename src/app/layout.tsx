import "./globals.css";
import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import { CartBadgeLink } from "@/components/nav/CartBadgeLink";
import { getServerSupabase } from "@/lib/supabase";
import SignOutButton from "@/components/nav/SignOutButton";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="es">
      <body className={`${poppins.className} min-h-screen bg-surfaceMuted text-brand-ink`}>
        <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-primary shadow-sm">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-white">
            <Link href="/" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
              <Image src="/brand/cta-logo.svg" alt="Close to Amazon" width={208} height={42} priority className="h-10 w-auto" />
            </Link>
            <div className="flex items-center gap-1 text-sm font-medium">
              <Link href="/" className="rounded px-3 py-1.5 hover:bg-white/10">Home</Link>
              <Link href="/shop" className="rounded px-3 py-1.5 hover:bg-white/10">Shop</Link>
              <CartBadgeLink />
              <Link href="/wishlist" className="rounded px-3 py-1.5 hover:bg-white/10">Wishlist</Link>
              {user ? <>
                <Link href="/account" className="rounded px-3 py-1.5 hover:bg-white/10">Cuenta</Link>
                <SignOutButton />
              </> : <Link href="/login" className="rounded px-3 py-1.5 hover:bg-white/10">Login</Link>}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
