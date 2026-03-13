import Image from "next/image";
import Link from "next/link";
import { Product } from "@/lib/types";
import { PriceDisplay } from "@/components/PriceDisplay";
import { RatingStars } from "@/components/RatingStars";
import { StockBadge } from "@/components/StockBadge";
import { AddToCartButton } from "@/components/AddToCartButton";

export function ProductCard({ product }: { product: Product }) {
  const minVariantPrice = product.variants?.length ? Math.min(...product.variants.map((v) => v.price_cents)) : null;
  const priceCents = minVariantPrice ?? product.base_price_cents ?? 0;
  const compareAtPriceCents = product.price_cents && product.price_cents > priceCents ? product.price_cents : null;
  const images = (product.images ?? []).sort((a, b) => a.sort_order - b.sort_order);
  const primaryImage = images[0]?.url ?? product.image_url;
  const secondaryImage = images[1]?.url;
  const stock = product.base_stock ?? product.qty ?? 0;
  const categoryLabel = product.category?.name ?? product.department ?? "General";
  const ratingValue = Number(product.featured ? 4.8 : 4.3);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-uiBorder bg-surface shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
        {primaryImage ? (
          <>
            <Image
              src={primaryImage}
              alt={product.name}
              fill
              className="object-cover transition duration-500 group-hover:opacity-0"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
            />
            <Image
              src={secondaryImage ?? primaryImage}
              alt={product.name}
              fill
              className="object-cover opacity-0 transition duration-500 group-hover:opacity-100"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-medium text-slate-500">
            No image available
          </div>
        )}
        <button type="button" aria-label="Add to wishlist" className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-slate-700 shadow-sm">
          ♡
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-brand-primary">{categoryLabel}</span>
          <StockBadge stock={stock} />
        </div>
        <Link href={`/product/${product.id}`} className="line-clamp-2 text-base font-semibold text-brand-ink hover:text-brand-primary">
          {product.name}
        </Link>

        <div className="flex items-center justify-between">
          <PriceDisplay priceCents={priceCents} compareAtPriceCents={compareAtPriceCents} />
          <RatingStars rating={ratingValue} />
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2">
          <AddToCartButton productId={product.id} name={product.name} unitPriceCents={priceCents} stock={stock} imageUrl={primaryImage} />
          <Link href={`/product/${product.id}`} className="btn-secondary w-full text-sm">
            Ver producto
          </Link>
        </div>
      </div>
    </article>
  );
}
