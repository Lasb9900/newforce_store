import Link from "next/link";

const columns = [
  {
    title: "Get to Know Us",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Shop", href: "/shop" },
      { label: "Categories", href: "/shop" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Shopping",
    links: [
      { label: "All Products", href: "/shop" },
      { label: "Cart", href: "/cart" },
      { label: "Wishlist", href: "/wishlist" },
      { label: "Account", href: "/account" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Customer Support", href: "/contact" },
      { label: "Order Help", href: "/account/orders" },
      { label: "Secure Checkout", href: "/checkout" },
      { label: "Product Questions", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Policies", href: "/policies" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 text-white">
      <div className="border-b border-white/15 bg-brand-primary">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-6 py-4 text-sm font-medium text-white">
          <span>🚚 Fast shipping</span>
          <span>🔒 Secure checkout</span>
          <span>📦 Verified inventory</span>
          <span>💬 Dedicated support</span>
        </div>
      </div>

      <a
        href="#top"
        className="block bg-[#16208a] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#111a73]"
      >
        Back to top
      </a>

      <div className="bg-brand-primary">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            {columns.map((column) => (
              <div key={column.title}>
                <h3 className="mb-4 text-base font-semibold text-white">{column.title}</h3>
                <ul className="space-y-2 text-sm text-white/80">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="transition hover:text-white hover:underline underline-offset-4"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/15 bg-[#16208a]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-8 md:flex-row">
          <div className="flex items-center gap-4">
            <img
              src="/brand/logo-icono.png"
              alt="Liquidation Plus icon"
              className="h-14 w-14 object-contain"
            />

            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-wide text-white">
                Liquidation Plus
              </span>
              <span className="text-sm text-white/70">
                Premium liquidation marketplace
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-white">
            <span className="rounded-md border border-white/20 bg-white/10 px-3 py-1">
              Visa
            </span>
            <span className="rounded-md border border-white/20 bg-white/10 px-3 py-1">
              Mastercard
            </span>
            <span className="rounded-md border border-white/20 bg-white/10 px-3 py-1">
              Amex
            </span>
            <span className="rounded-md border border-white/20 bg-white/10 px-3 py-1">
              PayPal
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#16208a]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-4 px-6 py-5 text-sm text-white/80">
          <Link href="/privacy" className="hover:text-white hover:underline underline-offset-4">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white hover:underline underline-offset-4">
            Terms
          </Link>
          <Link href="/policies" className="hover:text-white hover:underline underline-offset-4">
            Policies
          </Link>
          <Link href="/contact" className="hover:text-white hover:underline underline-offset-4">
            Contact
          </Link>
        </div>
      </div>

      <div className="bg-[#0f172a] px-6 py-5 text-center text-xs text-white/70">
        © 2026 Liquidation Plus. All rights reserved.
      </div>
    </footer>
  );
}