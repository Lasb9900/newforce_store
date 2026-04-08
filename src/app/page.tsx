import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { getFeaturedCategories, getProductsPublic, getTopSelling } from "@/lib/catalog";

const benefits = [
  { title: "Secure checkout", description: "Protected payment flow with order validation and secure processing." },
  { title: "Reliable delivery coordination", description: "Clear shipping coordination and order updates throughout fulfillment." },
  { title: "Quality verified inventory", description: "Carefully reviewed catalog with product details and stock visibility." },
  { title: "Personalized support", description: "Our team is available to help before, during, and after your purchase." },
];

export default async function Home() {
  const products = await getProductsPublic();

  const topSellingRows = await getTopSelling(30);
  const salesMap = new Map<string, number>();

  for (const row of topSellingRows) {
    const productId = row.product_id as string | null;
    const qty = Number(row.qty ?? 0);

    if (!productId) continue;
    salesMap.set(productId, (salesMap.get(productId) ?? 0) + qty);
  }

  const featured = products
    .filter((product) => product.featured)
    .sort((a, b) => (a.featured_rank ?? 0) - (b.featured_rank ?? 0));

  const bestSellers = [...products]
    .sort((a, b) => {
      const aQty = salesMap.get(a.id) ?? 0;
      const bQty = salesMap.get(b.id) ?? 0;

      if (bQty !== aQty) return bQty - aQty;

      const aFeaturedRank = a.featured_rank ?? Number.MAX_SAFE_INTEGER;
      const bFeaturedRank = b.featured_rank ?? Number.MAX_SAFE_INTEGER;

      if (aFeaturedRank !== bFeaturedRank) return aFeaturedRank - bFeaturedRank;

      return +new Date(b.created_at) - +new Date(a.created_at);
    })
    .slice(0, 8);

  const newArrivals = [...products]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 4);

  const deals = [...products]
    .filter((product) => {
      const current = product.price_cents ?? 0;
      const original = product.base_price_cents ?? 0;
      return original > 0 && current > 0 && current < original;
    })
    .sort((a, b) => {
      const aDiscount = (a.base_price_cents ?? 0) - (a.price_cents ?? 0);
      const bDiscount = (b.base_price_cents ?? 0) - (b.price_cents ?? 0);
      return bDiscount - aDiscount;
    })
    .slice(0, 4);

  const categoryHighlights = await getFeaturedCategories(products, 4);

  const bestSellersToShow = bestSellers.length
    ? bestSellers
    : featured.length
      ? featured.slice(0, 8)
      : products.slice(0, 8);

  const dealsToShow = deals.length
    ? deals
    : featured.length
      ? featured.slice(0, 4)
      : products.slice(0, 4);

  return (
    <div className="space-y-12">
      <section className="rounded-3xl bg-gradient-to-r from-brand-primary via-brand-secondary to-slate-900 px-6 py-10 text-white shadow-md md:px-10 md:py-14">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-white/70">
          Retail premium experience
        </p>
        <h1 className="max-w-3xl text-3xl font-extrabold leading-tight md:text-5xl">
          Tecnología y hogar con experiencia de compra moderna, confiable y rápida.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-white/85 md:text-base">
          Compra por categoría, compara ofertas reales y finaliza tu orden con checkout seguro en minutos.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/shop" className="btn-primary">
            Comprar ahora
          </Link>
          <Link
            href="/shop?discounted=true"
            className="btn-secondary border-white text-white hover:bg-white hover:text-brand-primary"
          >
            Ver ofertas
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-uiBorder bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-brand-ink">Featured categories</h2>
          <Link href="/shop" className="text-sm font-medium text-brand-primary hover:underline">
            Browse catalog
          </Link>
        </div>

        {categoryHighlights.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categoryHighlights.map((category) => (
              <Link
                key={category.slug}
                href={`/shop?category=${category.slug}`}
                className="rounded-xl border border-uiBorder bg-slate-50 px-4 py-6 text-center font-semibold text-slate-700 transition hover:border-brand-primary hover:text-brand-primary"
              >
                <p>{category.name}</p>
                <p className="mt-1 text-xs font-medium text-mutedText">
                  {category.productCount} products
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-mutedText">
            Categories will appear automatically as active products are added.
          </p>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-brand-ink">Best sellers</h2>
          <Link href="/shop?sort=best_selling" className="text-sm font-medium text-brand-primary hover:underline">
            View all
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {bestSellersToShow.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-bold">New arrivals</h2>
            <Link href="/shop?sort=newest" className="text-sm font-medium text-brand-primary hover:underline">
              Explore
            </Link>
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
            <Link href="/shop?discounted=true" className="text-sm font-medium text-brand-primary hover:underline">
              Save more
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {dealsToShow.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-uiBorder bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold">Why customers trust us</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => (
            <article key={benefit.title} className="rounded-xl border border-uiBorder bg-slate-50 p-4">
              <h3 className="text-base font-semibold text-brand-ink">{benefit.title}</h3>
              <p className="mt-1 text-sm text-mutedText">{benefit.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}