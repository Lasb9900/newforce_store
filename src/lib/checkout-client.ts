import { CheckoutItemInput, ShippingForm, ShippingOption } from "@/components/checkout/types";

function userMessageFromStatus(status: number, fallback: string) {
  if (status >= 500) return "We had trouble processing your request. Please try again in a moment.";
  return fallback;
}

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function validateCartRequest(items: CheckoutItemInput[]) {
  const response = await fetch("/api/cart/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const json = await parseJson(response);
  if (!response.ok) {
    throw new Error(userMessageFromStatus(response.status, "Your cart changed. Please review items and try again."));
  }
  return json as { subtotal_cents: number };
}

export async function getShippingRatesRequest(items: CheckoutItemInput[], shipping: ShippingForm) {
  const response = await fetch("/api/shipping/rates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, shipping }),
  });
  const json = await parseJson(response);
  if (!response.ok) {
    throw new Error(userMessageFromStatus(response.status, "Unable to calculate shipping. Verify your address and retry."));
  }

  return json as { shipping_options: ShippingOption[] };
}

export async function createStripeCheckoutRequest(payload: {
  items: CheckoutItemInput[];
  shipping: ShippingForm;
  shipping_option_id: ShippingOption["id"];
}) {
  const response = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await parseJson(response);
  if (!response.ok) {
    throw new Error(userMessageFromStatus(response.status, "Unable to continue to payment. Please try again."));
  }

  return json as { url?: string };
}
