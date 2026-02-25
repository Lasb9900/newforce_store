import Image from "next/image";
import Link from "next/link";
import { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const minVariantPrice = product.variants?.length ? Math.min(...product.variants.map((v) => v.price_cents)) : null;
  const price = minVariantPrice ?? product.base_price_cents ?? 0;

  return (
    <article className="group rounded-xl border border-uiBorder bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative mb-3 h-48 w-full overflow-hidden rounded-lg bg-surfaceMuted">
        <Image
          src={product.images?.[0]?.url ?? "https://placehold.co/600x400?text=Product"}
          alt={product.name}
          fill
          className="object-cover transition group-hover:scale-[1.02]"
          sizes="(max-width: 768px) 100vw, 25vw"
        />
      </div>
      <h3 className="line-clamp-2 text-lg font-semibold text-brand-ink">{product.name}</h3>
      <p className="line-clamp-2 text-sm text-mutedText">{product.description}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-bold text-brand-primary">{product.has_variants ? `Desde ${formatCurrency(price)}` : formatCurrency(price)}</span>
        {product.has_variants && <span className="rounded-full bg-brand-secondary/10 px-2.5 py-1 text-xs font-medium text-brand-secondary">Variantes</span>}
      </div>
      <Link href={`/product/${product.id}`} className="btn-primary mt-4 w-full text-sm">
        Ver producto
      </Link>
    </article>
  );
}
