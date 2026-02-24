"use client";

import { useEffect, useState } from "react";
import { CartItemRow } from "@/components/CartItemRow";
import { useCartStore } from "@/lib/cart-store";
import { formatCurrency } from "@/lib/utils";

export default function CartPage() {
  const { items, hydrate, updateQty, remove } = useCartStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => hydrate(), [hydrate]);

  const total = items.reduce((sum, i) => sum + (i.unitPriceCents ?? 0) * i.qty, 0);

  async function checkout() {
    setLoading(true);
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.map(({ productId, variantId, qty }) => ({ productId, variantId, qty })) }),
    });
    const json = await response.json();
    if (json.url) window.location.href = json.url;
    setLoading(false);
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Carrito</h1>
      {items.map((item, index) => (
        <CartItemRow key={`${item.productId}-${item.variantId}-${index}`} item={item} onQty={(qty) => updateQty(index, qty)} onRemove={() => remove(index)} />
      ))}
      <p className="mt-4 text-xl font-semibold">Total: {formatCurrency(total)}</p>
      <button onClick={checkout} disabled={loading || !items.length} className="mt-3 rounded bg-black px-4 py-2 text-white disabled:opacity-50">Checkout</button>
    </div>
  );
}
