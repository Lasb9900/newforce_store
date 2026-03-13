"use client";

import Link from "next/link";
import { useState } from "react";
import { Product, ProductVariant } from "@/lib/types";
import { VariantSelector } from "@/components/VariantSelector";
import { useCartStore } from "@/lib/cart-store";
import { formatCurrency } from "@/lib/utils";
import { getDisplayName } from "@/lib/catalog-presenter";

export function AddToCart({ product }: { product: Product }) {
  const [variantId, setVariantId] = useState<string>("");
  const [qty, setQty] = useState(1);
  const addItem = useCartStore((state) => state.addItem);
  const initialize = useCartStore((state) => state.initialize);
  const syncing = useCartStore((state) => state.syncing);

  const variant = product.variants?.find((item) => item.id === variantId) as ProductVariant | undefined;
  const price = variant?.price_cents ?? product.base_price_cents ?? 0;
  const stock = variant?.stock ?? product.base_stock;
  const outOfStock = stock <= 0;
  const invalidPrice = price <= 0;
  const displayName = getDisplayName(product);

  return (
    <div className="space-y-4 rounded-xl border border-uiBorder bg-surfaceMuted p-4">
      {product.has_variants && product.variants ? <VariantSelector variants={product.variants} value={variantId} onChange={setVariantId} /> : null}

      <div className="flex items-center justify-between rounded-lg bg-white p-3">
        <p className="text-sm font-semibold text-brand-primary">{invalidPrice ? "Price available at checkout" : formatCurrency(price)}</p>
        <p className="text-xs text-mutedText">SKU: {variant?.sku ?? product.sku ?? "N/A"}</p>
      </div>

      <div className="flex items-center gap-3">
        <label htmlFor="qty" className="text-sm font-medium">Qty</label>
        <input
          id="qty"
          type="number"
          min={1}
          max={Math.max(stock, 1)}
          value={qty}
          onChange={(event) => setQty(Math.max(1, Number(event.target.value || 1)))}
          className="w-20 rounded-lg border border-uiBorder bg-white px-2 py-1.5"
        />
        <span className="text-xs text-mutedText">Stock: {stock}</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={outOfStock || invalidPrice || syncing}
          className="btn-primary w-full disabled:opacity-50"
          onClick={async () => {
            await initialize();
            await addItem({
              productId: variant ? undefined : product.id,
              variantId: variant?.id,
              qty,
              name: displayName,
              unitPriceCents: price,
              variantName: variant?.variant_name,
              imageUrl: product.images?.[0]?.url,
              sku: variant?.sku ?? product.sku,
              availableStock: stock,
            });
          }}
        >
          {outOfStock ? "Out of stock" : invalidPrice ? "Price pending" : syncing ? "Updating..." : "Add to cart"}
        </button>
        <Link href="/cart" className="btn-secondary w-full text-center">Buy now</Link>
      </div>
    </div>
  );
}
