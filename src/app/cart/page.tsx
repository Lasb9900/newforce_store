"use client";

import { useEffect, useMemo, useState } from "react";
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

type FieldErrors = Partial<Record<keyof ShippingForm, string>>;

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
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;
    async function prefill() {
      const res = await fetch("/api/me/profile", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (cancelled) return;
      const profile = json?.data;
      setShipping((s) => ({
        ...s,
        full_name: s.full_name || profile?.full_name || "",
        email: s.email || profile?.email || "",
        phone: s.phone || profile?.phone || "",
      }));
    }
    prefill();
    return () => {
      cancelled = true;
    };
  }, []);

  const subtotal = items.reduce((sum, i) => sum + (i.unitPriceCents ?? 0) * i.qty, 0);
  const shippingCents = 0;
  const taxCents = 0;
  const total = subtotal + shippingCents + taxCents;

  const canCheckout = useMemo(() => items.length > 0 && !loading, [items.length, loading]);

  function validateShipping(form: ShippingForm) {
    const nextErrors: FieldErrors = {};
    if (!form.full_name.trim()) nextErrors.full_name = "Nombre completo es obligatorio";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = "Email inválido";
    if (form.phone.trim().length < 7) nextErrors.phone = "Teléfono inválido";
    if (!form.address_line_1.trim()) nextErrors.address_line_1 = "Dirección obligatoria";
    if (!form.city.trim()) nextErrors.city = "Ciudad obligatoria";
    if (!US_STATE_CODES.includes(form.state as (typeof US_STATE_CODES)[number])) nextErrors.state = "Selecciona un estado válido";
    if (!US_ZIP_REGEX.test(form.postal_code.trim())) nextErrors.postal_code = "ZIP inválido (12345 o 12345-6789)";
    if (form.country !== "US") nextErrors.country = "Solo enviamos a Estados Unidos";
    return nextErrors;
  }

  async function checkout() {
    const nextErrors = validateShipping(shipping);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;
    if (!items.length) return;

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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Checkout</h1>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold">1) Carrito</h2>
          {!items.length ? <p className="text-sm text-mutedText">Tu carrito está vacío.</p> : null}
          <div className="space-y-2">{items.map((item, index) => <CartItemRow key={`${item.productId}-${item.variantId}-${index}`} item={item} onQty={(qty) => updateQty(index, qty)} onRemove={() => remove(index)} />)}</div>
        </section>

        <aside className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm space-y-3 h-fit">
          <h2 className="text-lg font-semibold">2) Resumen de compra</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-mutedText">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex items-center justify-between"><span className="text-mutedText">Shipping</span><span>{shippingCents === 0 ? "Free" : formatCurrency(shippingCents)}</span></div>
            <div className="flex items-center justify-between"><span className="text-mutedText">Tax</span><span>{formatCurrency(taxCents)}</span></div>
            <div className="border-t border-uiBorder pt-2 flex items-center justify-between text-base font-bold"><span>Total</span><span className="text-brand-primary">{formatCurrency(total)}</span></div>
          </div>
          <button onClick={checkout} disabled={!canCheckout || Object.keys(validateShipping(shipping)).length > 0} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? "Procesando..." : "Checkout"}
          </button>
          {loading ? <p className="text-xs text-mutedText">Redirecting to payment...</p> : null}
        </aside>
      </div>

      <section className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold">3) Datos de entrega (USA)</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <input className="w-full rounded border border-uiBorder p-2" placeholder="Full name" value={shipping.full_name} onChange={(e) => setShipping((s) => ({ ...s, full_name: e.target.value }))} />
            {errors.full_name ? <p className="text-xs text-red-600 mt-1">{errors.full_name}</p> : null}
          </div>
          <div>
            <input className="w-full rounded border border-uiBorder p-2" placeholder="Email" type="email" value={shipping.email} onChange={(e) => setShipping((s) => ({ ...s, email: e.target.value }))} />
            {errors.email ? <p className="text-xs text-red-600 mt-1">{errors.email}</p> : null}
          </div>
          <div>
            <input className="w-full rounded border border-uiBorder p-2" placeholder="Phone (e.g. +1 305 555 1212)" value={shipping.phone} onChange={(e) => setShipping((s) => ({ ...s, phone: e.target.value }))} />
            {errors.phone ? <p className="text-xs text-red-600 mt-1">{errors.phone}</p> : null}
          </div>
          <div>
            <input className="w-full rounded border border-uiBorder p-2" placeholder="Address line 1" value={shipping.address_line_1} onChange={(e) => setShipping((s) => ({ ...s, address_line_1: e.target.value }))} />
            {errors.address_line_1 ? <p className="text-xs text-red-600 mt-1">{errors.address_line_1}</p> : null}
          </div>
          <input className="w-full rounded border border-uiBorder p-2" placeholder="Address line 2 (optional)" value={shipping.address_line_2} onChange={(e) => setShipping((s) => ({ ...s, address_line_2: e.target.value }))} />
          <div>
            <input className="w-full rounded border border-uiBorder p-2" placeholder="City" value={shipping.city} onChange={(e) => setShipping((s) => ({ ...s, city: e.target.value }))} />
            {errors.city ? <p className="text-xs text-red-600 mt-1">{errors.city}</p> : null}
          </div>
          <div>
            <select className="w-full rounded border border-uiBorder p-2" value={shipping.state} onChange={(e) => setShipping((s) => ({ ...s, state: e.target.value }))}>
              <option value="">State</option>
              {US_STATE_CODES.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
            {errors.state ? <p className="text-xs text-red-600 mt-1">{errors.state}</p> : null}
          </div>
          <div>
            <input className="w-full rounded border border-uiBorder p-2" placeholder="ZIP (12345 or 12345-6789)" value={shipping.postal_code} onChange={(e) => setShipping((s) => ({ ...s, postal_code: e.target.value }))} />
            {errors.postal_code ? <p className="text-xs text-red-600 mt-1">{errors.postal_code}</p> : null}
          </div>
          <input className="w-full rounded border border-uiBorder p-2 bg-surfaceMuted" value="United States (US)" readOnly />
          <textarea className="w-full rounded border border-uiBorder p-2 md:col-span-2" placeholder="Delivery notes (optional)" value={shipping.delivery_notes} onChange={(e) => setShipping((s) => ({ ...s, delivery_notes: e.target.value }))} />
        </div>
      </section>
    </div>
  );
}
