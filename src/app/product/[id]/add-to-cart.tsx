"use client";

import { useState } from "react";
import { Product, ProductVariant } from "@/lib/types";
import { VariantSelector } from "@/components/VariantSelector";
import { useCartStore } from "@/lib/cart-store";
import { formatCurrency } from "@/lib/utils";

export function AddToCart({ product }: { product: Product }) {
  const [variantId, setVariantId] = useState<string>("");
  const addItem = useCartStore((s) => s.addItem);
  const variant = product.variants?.find((v) => v.id === variantId) as ProductVariant | undefined;
  const price = variant?.price_cents ?? product.base_price_cents ?? 0;
  const stock = variant?.stock ?? product.base_stock;

  return (
    <div className="space-y-3 rounded border p-4">
      {product.has_variants && product.variants && <VariantSelector variants={product.variants} value={variantId} onChange={setVariantId} />}
      <p className="font-semibold">{formatCurrency(price)} · Stock {stock}</p>
      <button
        className="rounded bg-black px-4 py-2 text-white"
        onClick={() =>
          addItem({
            productId: variant ? undefined : product.id,
            variantId: variant?.id,
            qty: 1,
            name: product.name,
            unitPriceCents: price,
            variantName: variant?.variant_name,
            imageUrl: product.images?.[0]?.url,
          })
        }
      >
        Add to cart
      </button>
    </div>
  );
}
