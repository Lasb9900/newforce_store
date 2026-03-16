import Link from "next/link";
import { Product } from "@/lib/types";
import { PriceDisplay } from "@/components/PriceDisplay";
import { StockBadge } from "@/components/StockBadge";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductImage } from "@/components/ProductImage";
import { WishlistToggleButton } from "@/components/WishlistToggleButton";
import {
  getCompareAtPriceCents,
  getDisplayCategory,
  getDisplayName,
  getDisplayPriceCents,
  getPrimaryImage,
  getStockCount,
} from "@/lib/catalog-presenter";

export function ProductCard({ product }: { product: Product }) {
  const name = getDisplayName(product);
  const categoryLabel = getDisplayCategory(product);
  const priceCents = getDisplayPriceCents(product);
  const compareAtPriceCents = getCompareAtPriceCents(product, priceCents);
  const stock = getStockCount(product);
  const image = getPrimaryImage(product);
  const productHref = product.id ? `/product/${product.id}` : "/shop";
  const canBuy = Boolean(product.id && priceCents && stock > 0);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-uiBorder bg-surface shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
        <div className="absolute left-3 top-3 z-10 flex gap-2">
          {compareAtPriceCents ? <span className="rounded-full bg-rose-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">Sale</span> : null}
          {product.featured ? <span className="rounded-full bg-brand-primary px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">Top rated</span> : null}
        </div>

        <ProductImage src={image.primary} alt={name} fill className="object-cover transition duration-500 group-hover:opacity-0" sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw" />
        <ProductImage src={image.secondary ?? image.primary} alt={name} fill className="object-cover opacity-0 transition duration-500 group-hover:opacity-100" sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw" />

        {product.id ? <WishlistToggleButton productId={product.id} /> : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="line-clamp-1 rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-primary">{categoryLabel || "General"}</span>
          <StockBadge stock={stock} />
        </div>

        <Link href={productHref} className="line-clamp-2 min-h-12 text-base font-semibold text-brand-ink hover:text-brand-primary">
          {name}
        </Link>

        {priceCents ? <PriceDisplay priceCents={priceCents} compareAtPriceCents={compareAtPriceCents} /> : <p className="text-sm font-medium text-mutedText">Price available at checkout</p>}

        <div className="mt-auto grid grid-cols-2 gap-2">
          {canBuy ? (
            <AddToCartButton productId={product.id} name={name} unitPriceCents={priceCents ?? 0} stock={stock} imageUrl={image.primary} />
          ) : (
            <button disabled className="btn-primary w-full cursor-not-allowed text-sm opacity-60">
              Not available
            </button>
          )}
          <Link href={productHref} className="btn-secondary w-full text-sm">
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
