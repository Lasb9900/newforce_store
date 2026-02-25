"use client";

import { useEffect, useState } from "react";
import { CartItemRow } from "@/components/CartItemRow";
import { useCartStore } from "@/lib/cart-store";
import { formatCurrency } from "@/lib/utils";

export default function CartPage() {
  const { items, hydrate, updateQty, remove } = useCartStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const total = items.reduce((sum, i) => sum + (i.unitPriceCents ?? 0) * i.qty, 0);

  async function checkout() {
    setLoading(true);
    const validation = await fetch("/api/checkout/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.map(({ productId, variantId, qty }) => ({ productId, variantId, qty })) }),
    });
    const validationJson = await validation.json();
    const hasInvalid = (validationJson?.data ?? []).some((item: { valid: boolean }) => !item.valid);
    if (hasInvalid) {
      alert("Hay items sin stock o precio inválido");
      setLoading(false);
      return;
    }

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
    <div className="rounded-xl border border-uiBorder bg-surface p-5 shadow-sm">
      <h1 className="mb-1 text-2xl font-bold">Carrito</h1>
      <p className="mb-4 text-sm text-mutedText">Revisa cantidades y valida stock antes de checkout.</p>
      {items.map((item, index) => (
        <CartItemRow key={`${item.productId}-${item.variantId}-${index}`} item={item} onQty={(qty) => updateQty(index, qty)} onRemove={() => remove(index)} />
      ))}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xl font-bold text-brand-primary">Total: {formatCurrency(total)}</p>
        <button onClick={checkout} disabled={loading || !items.length} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
          Checkout
        </button>
      </div>
    </div>
  );
}
