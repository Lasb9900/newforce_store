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
  const [added, setAdded] = useState(false);

  const outOfStock = stock <= 0;

  return (
    <button
      type="button"
      disabled={outOfStock}
      className="btn-primary w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
      onClick={() => {
        addItem({
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
      {outOfStock ? "Out of stock" : added ? "Added ✓" : "Add to cart"}
    </button>
  );
}
