import { ValidatedCart } from "@/lib/checkout";

export type CheckoutPricing = {
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  discount_cents: number;
  total_cents: number;
};

export function buildCheckoutPricing(input: {
  cart: ValidatedCart;
  shippingCents: number;
  taxCents?: number;
  discountCents?: number;
}): CheckoutPricing {
  const subtotal_cents = input.cart.subtotal_cents;
  const shipping_cents = Math.max(0, input.shippingCents);
  const tax_cents = Math.max(0, input.taxCents ?? 0);
  const discount_cents = Math.max(0, input.discountCents ?? 0);
  const total_cents = Math.max(0, subtotal_cents + shipping_cents + tax_cents - discount_cents);

  return { subtotal_cents, shipping_cents, tax_cents, discount_cents, total_cents };
}
