import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createCheckoutSchema } from "@/lib/schemas";
import { getServerSupabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const body = await req.json();
  console.log("[CHECKOUT] payload received:", body);

  if (!stripe) {
    console.log("[CHECKOUT] error exact:", "Stripe not configured (missing STRIPE_SECRET_KEY)");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const parsed = createCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    console.log("[CHECKOUT] error exact:", parsed.error.flatten());
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const shipping = parsed.data.shipping;
  console.log("[CHECKOUT] shipping data present:", !!shipping);
  console.log("[CHECKOUT] cart items:", parsed.data.items);

  const sb = await getServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  let computedTotal = 0;

  for (const item of parsed.data.items) {
    if (item.variantId) {
      const { data: variant } = await sb
        .from("product_variants")
        .select("id, variant_name, price_cents, stock, active, products(name,currency,active)")
        .eq("id", item.variantId)
        .single();

      const productRow = Array.isArray(variant?.products) ? variant?.products[0] : variant?.products;
      const unitAmount = Number(variant?.price_cents ?? 0);
      if (!variant?.active || !productRow?.active || variant.stock < item.qty || unitAmount <= 0) {
        return NextResponse.json({ error: `Variant ${item.variantId} invalid stock/active/price` }, { status: 400 });
      }

      computedTotal += unitAmount * item.qty;
      lineItems.push({
        quantity: item.qty,
        price_data: {
          currency: String(productRow?.currency ?? "USD").toLowerCase(),
          unit_amount: unitAmount,
          product_data: { name: `${productRow?.name ?? "Product"} - ${variant.variant_name}` },
        },
      });
    } else if (item.productId) {
      const { data: product } = await sb
        .from("products")
        .select("id,name,currency,active,base_price_cents,base_stock,has_variants")
        .eq("id", item.productId)
        .single();

      const unitAmount = Number(product?.base_price_cents ?? 0);
      if (!product?.active || product.has_variants || product.base_stock < item.qty || unitAmount <= 0) {
        return NextResponse.json({ error: `Product ${item.productId} invalid stock/active/price` }, { status: 400 });
      }

      computedTotal += unitAmount * item.qty;
      lineItems.push({
        quantity: item.qty,
        price_data: {
          currency: String(product.currency ?? "USD").toLowerCase(),
          unit_amount: unitAmount,
          product_data: { name: product.name },
        },
      });
    }
  }

  console.log("[CHECKOUT] computed total:", computedTotal);
  if (computedTotal <= 0 || lineItems.length === 0) {
    return NextResponse.json({ error: "Cart total inválido" }, { status: 400 });
  }

  const successUrl = env.STRIPE_SUCCESS_URL ?? `${env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = env.STRIPE_CANCEL_URL ?? `${env.NEXT_PUBLIC_SITE_URL}/cancel`;

  console.log("[CHECKOUT] stripe key present:", Boolean(env.STRIPE_SECRET_KEY));
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    client_reference_id: user?.id,
    mode: "payment",
    line_items: lineItems,
    customer_email: shipping.email,
    shipping_address_collection: { allowed_countries: ["US"] },
    phone_number_collection: { enabled: true },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      cart: JSON.stringify(parsed.data.items).slice(0, 450),
      shipping_full_name: shipping.full_name,
      shipping_email: shipping.email,
      shipping_phone: shipping.phone,
      shipping_address_line_1: shipping.address_line_1,
      shipping_city: shipping.city,
      shipping_state: shipping.state,
      shipping_postal_code: shipping.postal_code,
    },
  };

  console.log("[CHECKOUT] stripe session params:", {
    mode: sessionParams.mode,
    lineItemsCount: sessionParams.line_items?.length,
    success_url: sessionParams.success_url,
    cancel_url: sessionParams.cancel_url,
    customer_email: sessionParams.customer_email,
  });

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.log("[CHECKOUT] error exact:", error);
    return NextResponse.json({ error: (error as Error).message || "Stripe checkout failed" }, { status: 500 });
  }
}
