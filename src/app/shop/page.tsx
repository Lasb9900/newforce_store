import { ProductCard } from "@/components/ProductCard";
import { getProductsPublic } from "@/lib/catalog";

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const q = (params.q ?? "").toLowerCase();
  const products = (await getProductsPublic()).filter((p) => p.name.toLowerCase().includes(q));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Shop</h1>
      <form className="mb-4">
        <input name="q" defaultValue={q} placeholder="Buscar" className="w-full rounded border border-slate-300 bg-white p-2" />
      </form>
      <div className="grid gap-4 md:grid-cols-4">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
    </div>
  );
}
