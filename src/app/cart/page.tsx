"use client";

import { useEffect, useMemo, useState } from "react";
import { useCartStore } from "@/lib/cart-store";
import { US_STATE_CODES, US_ZIP_REGEX } from "@/lib/us-address";
import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";
import { CheckoutTrustBadges } from "@/components/checkout/CheckoutTrustBadges";
import { CheckoutCartItems } from "@/components/checkout/CheckoutCartItems";
import { ShippingAddressForm } from "@/components/checkout/ShippingAddressForm";
import { ShippingMethods } from "@/components/checkout/ShippingMethods";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { CheckoutActions } from "@/components/checkout/CheckoutActions";
import { FieldErrors, initialShippingForm, ShippingForm, ShippingOption } from "@/components/checkout/types";
import { createStripeCheckoutRequest, getShippingRatesRequest, validateCartRequest } from "@/lib/checkout-client";

const SHIPPING_STORAGE_KEY = "nf_checkout_shipping";

function mapItemsPayload(items: ReturnType<typeof useCartStore.getState>["items"]) {
  return items.map(({ productId, variantId, qty }) => ({ productId, variantId, qty }));
}

export default function CartPage() {
  const { items, hydrate, updateQty, remove } = useCartStore();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [shipping, setShipping] = useState<ShippingForm>(initialShippingForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [shippingMessage, setShippingMessage] = useState<string | null>(null);
  const [subtotalCents, setSubtotalCents] = useState(0);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState<ShippingOption["id"] | "">("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const stored = sessionStorage.getItem(SHIPPING_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as ShippingForm;
      setShipping((prev) => ({ ...prev, ...parsed, country: "US" }));
    } catch {
      sessionStorage.removeItem(SHIPPING_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(SHIPPING_STORAGE_KEY, JSON.stringify(shipping));
  }, [shipping]);

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

  const canCheckout = useMemo(
    () => items.length > 0 && !loadingCheckout && !!selectedShipping,
    [items.length, loadingCheckout, selectedShipping],
  );

  function validateShipping(form: ShippingForm) {
    const nextErrors: FieldErrors = {};
    if (!form.full_name.trim()) nextErrors.full_name = "Please enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = "Please enter a valid email.";
    if (form.phone.trim().length < 7) nextErrors.phone = "Please enter a valid phone number.";
    if (!form.address_line_1.trim()) nextErrors.address_line_1 = "Address line 1 is required.";
    if (!form.city.trim()) nextErrors.city = "City is required.";
    if (!US_STATE_CODES.includes(form.state as (typeof US_STATE_CODES)[number])) nextErrors.state = "Select a valid US state.";
    if (!US_ZIP_REGEX.test(form.postal_code.trim())) nextErrors.postal_code = "Enter a valid US ZIP code.";
    if (form.country !== "US") nextErrors.country = "Only US addresses are supported.";
    return nextErrors;
  }

  function focusFirstError(nextErrors: FieldErrors) {
    const firstField = Object.keys(nextErrors)[0] as keyof ShippingForm | undefined;
    if (!firstField) return;
    const target = document.getElementById(`field-${firstField}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    (target as HTMLInputElement | HTMLSelectElement | null)?.focus();
  }

  async function refreshCartSummary() {
    setLoadingSummary(true);
    try {
      const cart = await validateCartRequest(mapItemsPayload(items));
      setSubtotalCents(cart.subtotal_cents ?? 0);
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handleCalculateShipping() {
    setFormMessage(null);
    setShippingMessage(null);
    const nextErrors = validateShipping(shipping);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setShippingMessage("Complete your shipping address before calculating shipping.");
      focusFirstError(nextErrors);
      return;
    }

    setLoadingRates(true);
    try {
      const cart = await validateCartRequest(mapItemsPayload(items));
      setSubtotalCents(cart.subtotal_cents ?? 0);
      const rates = await getShippingRatesRequest(mapItemsPayload(items), shipping);
      setShippingOptions(rates.shipping_options ?? []);
      setSelectedShippingId(rates.shipping_options?.[0]?.id ?? "");
    } catch {
      setShippingMessage("We couldn't calculate shipping rates right now. Please review your address and retry.");
    } finally {
      setLoadingRates(false);
    }
  }

  async function handleCheckout() {
    setFormMessage(null);
    const nextErrors = validateShipping(shipping);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormMessage("Please review the highlighted address fields.");
      focusFirstError(nextErrors);
      return;
    }
    if (!selectedShipping) {
      setShippingMessage("Please calculate and select a shipping method.");
      return;
    }

    setLoadingCheckout(true);
    try {
      const cart = await validateCartRequest(mapItemsPayload(items));
      setSubtotalCents(cart.subtotal_cents ?? 0);
      const { url } = await createStripeCheckoutRequest({
        items: mapItemsPayload(items),
        shipping,
        shipping_option_id: selectedShipping.id,
      });
      if (url) {
        window.location.href = url;
      }
    } catch {
      setFormMessage("Unable to continue to payment. Please try again.");
      setLoadingCheckout(false);
    }
  }

  useEffect(() => {
    refreshCartSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return (
    <div className="space-y-4">
      <CheckoutHeader />
      <CheckoutTrustBadges />

      {formMessage ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formMessage}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <CheckoutCartItems items={items} onQty={updateQty} onRemove={remove} />
          <ShippingAddressForm value={shipping} errors={errors} onChange={(patch) => setShipping((prev) => ({ ...prev, ...patch }))} />
          <ShippingMethods
            options={shippingOptions}
            selectedId={selectedShippingId}
            loading={loadingRates}
            disabled={!items.length}
            message={shippingMessage}
            onCalculate={handleCalculateShipping}
            onSelect={setSelectedShippingId}
          />
          <section className="rounded-2xl border border-uiBorder bg-surface p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">5. Payment</h2>
            <CheckoutActions
              disabled={!canCheckout}
              loading={loadingCheckout}
              missingShipping={!selectedShipping}
              onCheckout={handleCheckout}
            />
          </section>
        </div>

        <OrderSummary
          items={items}
          subtotal={subtotalCents}
          shipping={shippingCents}
          tax={taxCents}
          loading={loadingSummary || loadingRates}
        />
      </div>
    </div>
  );
}
