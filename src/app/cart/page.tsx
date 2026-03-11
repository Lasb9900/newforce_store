"use client";

import { useEffect, useState } from "react";
import { CartItemRow } from "@/components/CartItemRow";
import { useCartStore } from "@/lib/cart-store";
import { formatCurrency } from "@/lib/utils";
import { US_STATE_CODES, US_ZIP_REGEX } from "@/lib/us-address";

type ShippingForm = {
  full_name: string;
  email: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: "US";
  delivery_notes: string;
};

const initialShipping: ShippingForm = {
  full_name: "",
  email: "",
  phone: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "US",
  delivery_notes: "",
};

export default function CartPage() {
  const { items, hydrate, updateQty, remove } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [shipping, setShipping] = useState<ShippingForm>(initialShipping);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const total = items.reduce((sum, i) => sum + (i.unitPriceCents ?? 0) * i.qty, 0);

  function shippingValid() {
    if (!shipping.full_name.trim() || !shipping.email.trim() || !shipping.phone.trim()) return false;
    if (!shipping.address_line_1.trim() || !shipping.city.trim()) return false;
    if (!US_STATE_CODES.includes(shipping.state as (typeof US_STATE_CODES)[number])) return false;
    if (!US_ZIP_REGEX.test(shipping.postal_code.trim())) return false;
    return shipping.country === "US";
  }

  async function checkout() {
    if (!shippingValid()) {
      alert("Completa datos válidos de envío en Estados Unidos (state + ZIP)");
      return;
    }

    setLoading(true);
    const payload = {
      items: items.map(({ productId, variantId, qty }) => ({ productId, variantId, qty })),
      shipping,
    };

    const validation = await fetch("/api/checkout/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    if (!response.ok) {
      alert(json.error || "Error de checkout");
      setLoading(false);
      return;
    }

    if (json.url) window.location.href = json.url;
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-uiBorder bg-surface p-5 shadow-sm space-y-4">
      <h1 className="mb-1 text-2xl font-bold">Carrito</h1>
      <p className="mb-2 text-sm text-mutedText">Revisa cantidades, completa entrega en USA y valida stock antes de checkout.</p>
      {items.map((item, index) => (
        <CartItemRow key={`${item.productId}-${item.variantId}-${index}`} item={item} onQty={(qty) => updateQty(index, qty)} onRemove={() => remove(index)} />
      ))}

      <section className="rounded border border-uiBorder p-4 space-y-3">
        <h2 className="font-semibold">Datos de entrega (solo Estados Unidos)</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <input className="rounded border border-uiBorder p-2" placeholder="Nombre completo" value={shipping.full_name} onChange={(e) => setShipping((s) => ({ ...s, full_name: e.target.value }))} />
          <input className="rounded border border-uiBorder p-2" placeholder="Email" type="email" value={shipping.email} onChange={(e) => setShipping((s) => ({ ...s, email: e.target.value }))} />
          <input className="rounded border border-uiBorder p-2" placeholder="Teléfono" value={shipping.phone} onChange={(e) => setShipping((s) => ({ ...s, phone: e.target.value }))} />
          <input className="rounded border border-uiBorder p-2" placeholder="Dirección línea 1" value={shipping.address_line_1} onChange={(e) => setShipping((s) => ({ ...s, address_line_1: e.target.value }))} />
          <input className="rounded border border-uiBorder p-2" placeholder="Dirección línea 2 (opcional)" value={shipping.address_line_2} onChange={(e) => setShipping((s) => ({ ...s, address_line_2: e.target.value }))} />
          <input className="rounded border border-uiBorder p-2" placeholder="Ciudad" value={shipping.city} onChange={(e) => setShipping((s) => ({ ...s, city: e.target.value }))} />
          <select className="rounded border border-uiBorder p-2" value={shipping.state} onChange={(e) => setShipping((s) => ({ ...s, state: e.target.value }))}>
            <option value="">Estado (USA)</option>
            {US_STATE_CODES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
          <input className="rounded border border-uiBorder p-2" placeholder="ZIP (12345 o 12345-6789)" value={shipping.postal_code} onChange={(e) => setShipping((s) => ({ ...s, postal_code: e.target.value }))} />
          <input className="rounded border border-uiBorder p-2 md:col-span-2 bg-surfaceMuted" value="US" readOnly />
          <textarea className="rounded border border-uiBorder p-2 md:col-span-2" placeholder="Notas de entrega (opcional)" value={shipping.delivery_notes} onChange={(e) => setShipping((s) => ({ ...s, delivery_notes: e.target.value }))} />
        </div>
      </section>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xl font-bold text-brand-primary">Total: {formatCurrency(total)}</p>
        <button onClick={checkout} disabled={loading || !items.length} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
          Checkout
        </button>
      </div>
    </div>
  );
}
