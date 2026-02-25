import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { getProductsPublic } from "@/lib/catalog";

export default async function Home() {
  const products = await getProductsPublic();
  const featured = products.filter((p) => p.featured).sort((a, b) => a.featured_rank - b.featured_rank);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-gradient-to-r from-brand-primary to-brand-secondary px-6 py-10 text-white shadow-sm md:px-10">
        <p className="mb-2 text-sm font-light uppercase tracking-wide text-white/80">Close to Amazon Storefront</p>
        <h1 className="max-w-2xl text-3xl font-extrabold leading-tight md:text-5xl">Electrodomésticos y tecnología para tu hogar, con entrega segura.</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/85 md:text-base">Compra por categoría, compara variantes y completa tu checkout en minutos.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/shop" className="btn-primary">Explorar catálogo</Link>
          <Link href="/wishlist" className="btn-secondary border-white text-white hover:bg-white hover:text-brand-primary">Ver wishlist</Link>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-brand-ink">Productos destacados</h2>
          <Link href="/shop" className="text-sm font-medium text-brand-primary hover:underline">Ver todos</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {featured.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
    </div>
  );
}
