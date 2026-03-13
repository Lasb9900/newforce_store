import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { getProductsPublic } from "@/lib/catalog";

export default async function Home() {
  const products = await getProductsPublic();
  const featured = products.filter((product) => product.featured).slice(0, 8);
  const newArrivals = [...products].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 4);
  const deals = products
    .filter((product) => (product.price_cents ?? 0) > (product.base_price_cents ?? 0))
    .slice(0, 4);

  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-gradient-to-r from-brand-primary via-brand-secondary to-slate-900 px-6 py-10 text-white shadow-md md:px-10 md:py-14">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-white/70">Retail premium experience</p>
        <h1 className="max-w-3xl text-3xl font-extrabold leading-tight md:text-5xl">Tecnología y hogar con experiencia de compra moderna, confiable y rápida.</h1>
        <p className="mt-4 max-w-2xl text-sm text-white/85 md:text-base">Compra por categoría, compara descuentos reales, gestiona tu carrito y prepárate para checkout seguro.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/shop" className="btn-primary">Comprar ahora</Link>
          <Link href="/shop?discounted=true" className="btn-secondary border-white text-white hover:bg-white hover:text-brand-primary">Ver ofertas</Link>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-brand-ink">Best sellers</h2>
          <Link href="/shop?sort=best_selling" className="text-sm font-medium text-brand-primary hover:underline">View all</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-bold">New arrivals</h2>
            <Link href="/shop?sort=newest" className="text-sm font-medium text-brand-primary hover:underline">Explore</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-bold">Top deals</h2>
            <Link href="/shop?discounted=true" className="text-sm font-medium text-brand-primary hover:underline">Save more</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(deals.length ? deals : featured.slice(0, 4)).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
