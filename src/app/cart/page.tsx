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

type ShippingOption = {
  id: "standard";
  name: string;
  amount_cents: number;
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
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [shipping, setShipping] = useState<ShippingForm>(initialShipping);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [subtotalCents, setSubtotalCents] = useState(0);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState<"standard" | "">("");

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

  useEffect(() => {
    setShippingOptions([]);
    setSelectedShippingId("");
  }, [shipping.address_line_1, shipping.city, shipping.state, shipping.postal_code, items]);

  const selectedShipping = shippingOptions.find((option) => option.id === selectedShippingId) ?? null;
  const shippingCents = selectedShipping?.amount_cents ?? 0;
  const taxCents = 0;
  const totalCents = subtotalCents + shippingCents + taxCents;

  const canCheckout = useMemo(
    () => items.length > 0 && !loadingCheckout && !!selectedShipping,
    [items.length, loadingCheckout, selectedShipping],
  );

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

  async function validateCart() {
    const res = await fetch("/api/cart/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.map(({ productId, variantId, qty }) => ({ productId, variantId, qty })) }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "No se pudo validar carrito");
    }
    setSubtotalCents(json.subtotal_cents ?? 0);
    return json;
  }

  async function fetchShippingRates() {
    const nextErrors = validateShipping(shipping);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoadingRates(true);
    try {
      await validateCart();
      const res = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(({ productId, variantId, qty }) => ({ productId, variantId, qty })),
          shipping,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "No se pudo calcular shipping");
      }
      const options = (json.shipping_options ?? []) as ShippingOption[];
      setShippingOptions(options);
      setSelectedShippingId(options[0]?.id ?? "");
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setLoadingRates(false);
    }
  }

  async function checkout() {
    if (!items.length || !selectedShipping) return;

    const nextErrors = validateShipping(shipping);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoadingCheckout(true);

    try {
      await validateCart();
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(({ productId, variantId, qty }) => ({ productId, variantId, qty })),
          shipping,
          shipping_option_id: selectedShipping.id,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Error de checkout");
      }

      if (json.url) {
        window.location.href = json.url;
      }
    } catch (error) {
      alert((error as Error).message);
      setLoadingCheckout(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Checkout</h1>

      <section className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold">1) Carrito</h2>
        {!items.length ? <p className="text-sm text-mutedText">Tu carrito está vacío.</p> : null}
        <div className="space-y-2">{items.map((item, index) => <CartItemRow key={`${item.productId}-${item.variantId}-${index}`} item={item} onQty={(qty) => updateQty(index, qty)} onRemove={() => remove(index)} />)}</div>
      </section>

      <section className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold">2) Dirección de entrega (USA)</h2>
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

      <section className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold">3) Método de envío</h2>
        <button onClick={fetchShippingRates} disabled={loadingRates || items.length === 0} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60">
          {loadingRates ? "Calculando..." : "Calcular shipping"}
        </button>
        <div className="space-y-2">
          {shippingOptions.map((option) => (
            <label key={option.id} className="flex items-center justify-between rounded border border-uiBorder p-2 cursor-pointer">
              <span className="flex items-center gap-2">
                <input type="radio" name="shipping-option" checked={selectedShippingId === option.id} onChange={() => setSelectedShippingId(option.id)} />
                {option.name}
              </span>
              <span>{option.amount_cents === 0 ? "Free" : formatCurrency(option.amount_cents)}</span>
            </label>
          ))}
          {!shippingOptions.length ? <p className="text-sm text-mutedText">Calcula shipping para seleccionar el método.</p> : null}
        </div>
      </section>

      <aside className="rounded-xl border border-uiBorder bg-surface p-4 shadow-sm space-y-3 h-fit">
        <h2 className="text-lg font-semibold">4) Resumen de compra</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between"><span className="text-mutedText">Subtotal</span><span>{formatCurrency(subtotalCents)}</span></div>
          <div className="flex items-center justify-between"><span className="text-mutedText">Shipping</span><span>{shippingCents === 0 ? "Free" : formatCurrency(shippingCents)}</span></div>
          <div className="flex items-center justify-between"><span className="text-mutedText">Tax</span><span>{formatCurrency(taxCents)}</span></div>
          <div className="border-t border-uiBorder pt-2 flex items-center justify-between text-base font-bold"><span>Total</span><span className="text-brand-primary">{formatCurrency(totalCents)}</span></div>
        </div>
        <button onClick={checkout} disabled={!canCheckout} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
          {loadingCheckout ? "Procesando..." : "5) Ir a Checkout"}
        </button>
        {loadingCheckout ? <p className="text-xs text-mutedText">Redirigiendo a Stripe...</p> : null}
      </aside>
    </div>
  );
}
