import Stripe from "stripe";
import { ValidatedCart } from "@/lib/checkout";

export function buildStripeLineItems(params: {
  cart: ValidatedCart;
  shippingName: string;
  shippingCents: number;
}): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = params.cart.items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency: "usd",
      unit_amount: item.unit_price_cents,
      product_data: { name: item.product_name_snapshot },
    },
  }));

  if (params.shippingCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: params.shippingCents,
        product_data: { name: params.shippingName },
      },
    });
  }

  return lineItems;
}
