import Image from "next/image";
import Link from "next/link";
import { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const minVariantPrice = product.variants?.length
    ? Math.min(...product.variants.map((v) => v.price_cents))
    : null;
  const price = minVariantPrice ?? product.base_price_cents ?? 0;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="relative mb-3 h-48 w-full overflow-hidden rounded">
        <Image
          src={product.images?.[0]?.url ?? "https://placehold.co/600x400"}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 25vw"
        />
      </div>
      <h3 className="text-lg font-semibold">{product.name}</h3>
      <p className="line-clamp-2 text-sm text-slate-600">{product.description}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-bold">{product.has_variants ? `Desde ${formatCurrency(price)}` : formatCurrency(price)}</span>
        {product.has_variants && <span className="rounded bg-slate-100 px-2 py-1 text-xs">Variantes</span>}
      </div>
      <Link href={`/product/${product.id}`} className="mt-3 inline-block rounded bg-slate-900 px-3 py-2 text-white">
        Ver producto
      </Link>
    </article>
  );
}
