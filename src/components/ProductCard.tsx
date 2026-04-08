import Link from "next/link";
import { Product } from "@/lib/types";
import { PriceDisplay } from "@/components/PriceDisplay";
import { StockBadge } from "@/components/StockBadge";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductImage } from "@/components/ProductImage";
import { WishlistToggleButton } from "@/components/WishlistToggleButton";
import {
  getDisplayCategory,
  getDisplayName,
  getPrimaryImage,
  getStockCount,
} from "@/lib/catalog-presenter";

export function ProductCard({ product }: { product: Product }) {
  const name = getDisplayName(product);
  const categoryLabel = getDisplayCategory(product);

  const selectedVariant = product.has_variants
    ? (product.variants ?? []).find((variant) => variant.active && variant.stock > 0) ?? product.variants?.[0]
    : null;

  const priceCents =
    selectedVariant?.price_cents ??
    product.price_cents ??
    product.base_price_cents ??
    null;

  const compareAtPriceCents =
    !selectedVariant &&
    typeof product.base_price_cents === "number" &&
    typeof priceCents === "number" &&
    product.base_price_cents > 0 &&
    priceCents > 0 &&
    priceCents < product.base_price_cents
      ? product.base_price_cents
      : null;

  const stock = selectedVariant?.stock ?? getStockCount(product);
  const image = getPrimaryImage(product);
  const productId = product.id;

  const hasDiscount =
    typeof priceCents === "number" &&
    typeof compareAtPriceCents === "number" &&
    compareAtPriceCents > 0 &&
    priceCents > 0 &&
    priceCents < compareAtPriceCents;

  const discountPercent = hasDiscount
    ? Math.round(((compareAtPriceCents - priceCents) / compareAtPriceCents) * 100)
    : 0;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-uiBorder bg-surface shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
          {hasDiscount ? (
            <span className="rounded-full bg-rose-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
              Sale
            </span>
          ) : null}

          {hasDiscount && discountPercent > 0 ? (
            <span className="rounded-full bg-amber-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-950">
              -{discountPercent}%
            </span>
          ) : null}

          {product.featured ? (
            <span className="rounded-full bg-brand-primary px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
              Featured
            </span>
          ) : null}
        </div>

        <ProductImage
          src={image.primary}
          alt={name}
          fill
          className="object-cover transition duration-500 group-hover:opacity-0"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
        />
        <ProductImage
          src={image.secondary ?? image.primary}
          alt={name}
          fill
          className="object-cover opacity-0 transition duration-500 group-hover:opacity-100"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
        />

        <WishlistToggleButton productId={productId} />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="line-clamp-1 rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-primary">
            {categoryLabel}
          </span>
          <StockBadge stock={stock} />
        </div>

        <Link
          href={`/product/${productId}`}
          className="line-clamp-2 min-h-12 text-base font-semibold text-brand-ink hover:text-brand-primary"
        >
          {name}
        </Link>

        {typeof priceCents === "number" && priceCents > 0 ? (
          <div className="space-y-1">
            <PriceDisplay priceCents={priceCents} compareAtPriceCents={compareAtPriceCents} />
            {hasDiscount ? (
              <p className="text-xs font-medium text-emerald-600">
                You save {discountPercent}% on this item
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm font-medium text-mutedText">Price available at checkout</p>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2">
          <AddToCartButton
            productId={productId}
            variantId={selectedVariant?.id ?? null}
            variantName={selectedVariant?.variant_name ?? null}
            sku={selectedVariant?.sku ?? product.sku ?? null}
            name={name}
            unitPriceCents={selectedVariant?.price_cents ?? priceCents ?? 0}
            stock={stock}
            imageUrl={image.primary}
          />
          <Link href={`/product/${productId}`} className="btn-secondary w-full text-sm">
            View
          </Link>
        </div>
      </div>
    </article>
  );
}