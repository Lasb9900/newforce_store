"use client";

import { useState } from "react";
import { useCartStore } from "@/lib/cart-store";

type AddToCartButtonProps = {
  productId: string;
  name: string;
  unitPriceCents: number;
  imageUrl?: string | null;
  stock: number;
};

export function AddToCartButton({ productId, name, unitPriceCents, imageUrl, stock }: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const initialize = useCartStore((state) => state.initialize);
  const syncing = useCartStore((state) => state.syncing);
  const [added, setAdded] = useState(false);

  const outOfStock = stock <= 0;
  const priceUnavailable = unitPriceCents <= 0;

  return (
    <button
      type="button"
      disabled={outOfStock || priceUnavailable || syncing}
      className="btn-primary w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
      onClick={async () => {
        await initialize();
        await addItem({
          productId,
          qty: 1,
          name,
          unitPriceCents,
          imageUrl: imageUrl ?? undefined,
          availableStock: stock,
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 1400);
      }}
    >
      {outOfStock ? "Out of stock" : priceUnavailable ? "Price pending" : added ? "Added ✓" : syncing ? "Updating..." : "Add to cart"}
    </button>
  );
}
