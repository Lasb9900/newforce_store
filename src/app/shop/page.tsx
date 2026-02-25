import { ProductCard } from "@/components/ProductCard";
import { getProductsPublic } from "@/lib/catalog";

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const q = (params.q ?? "").toLowerCase();
  const products = (await getProductsPublic()).filter((p) => p.name.toLowerCase().includes(q));

  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-uiBorder bg-surface px-5 py-4">
        <h1 className="text-2xl font-bold text-brand-ink">Shop</h1>
        <p className="text-sm text-mutedText">Encuentra electrodomésticos y tecnología por categoría.</p>
        <form className="mt-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar producto..."
            className="w-full rounded-md border border-uiBorder bg-surface p-2.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
          />
        </form>
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
    </div>
  );
}
