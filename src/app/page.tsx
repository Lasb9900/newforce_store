import { ProductCard } from "@/components/ProductCard";
import { getProductsPublic } from "@/lib/catalog";

export default async function Home() {
  const products = await getProductsPublic();
  const featured = products.filter((p) => p.featured).sort((a, b) => a.featured_rank - b.featured_rank);
  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-2xl font-bold">Productos destacados</h1>
        <div className="grid gap-4 md:grid-cols-3">{featured.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      </section>
      <section>
        <h2 className="mb-4 text-2xl font-bold">Catálogo</h2>
        <div className="grid gap-4 md:grid-cols-4">{products.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} />)}</div>
      </section>
    </div>
  );
}
