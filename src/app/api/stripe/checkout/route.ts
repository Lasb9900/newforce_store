import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createCheckoutSchema } from "@/lib/schemas";
import { getServerSupabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

  const parsed = createCheckoutSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const sb = await getServerSupabase();
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  for (const item of parsed.data.items) {
    if (item.variantId) {
      const { data: variant } = await sb
        .from("product_variants")
        .select("id, variant_name, price_cents, stock, active, products(name,currency,active)")
        .eq("id", item.variantId)
        .single();

      const productRow = Array.isArray(variant?.products) ? variant?.products[0] : variant?.products;
      if (!variant?.active || !productRow?.active || variant.stock < item.qty) {
        return NextResponse.json({ error: `Variant ${item.variantId} invalid stock/active` }, { status: 400 });
      }

      lineItems.push({
        quantity: item.qty,
        price_data: {
          currency: String(productRow?.currency ?? "USD").toLowerCase(),
          unit_amount: variant.price_cents,
          product_data: { name: `${productRow?.name ?? "Product"} - ${variant.variant_name}` },
        },
      });
    } else if (item.productId) {
      const { data: product } = await sb
        .from("products")
        .select("id,name,currency,active,base_price_cents,base_stock,has_variants")
        .eq("id", item.productId)
        .single();

      if (!product?.active || product.has_variants || product.base_stock < item.qty || !product.base_price_cents) {
        return NextResponse.json({ error: `Product ${item.productId} invalid stock/active` }, { status: 400 });
      }

      lineItems.push({
        quantity: item.qty,
        price_data: {
          currency: String(product.currency ?? "USD").toLowerCase(),
          unit_amount: product.base_price_cents,
          product_data: { name: product.name },
        },
      });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    shipping_address_collection: { allowed_countries: ["US"] },
    phone_number_collection: { enabled: true },
    success_url: env.STRIPE_SUCCESS_URL ?? `${env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: env.STRIPE_CANCEL_URL ?? `${env.NEXT_PUBLIC_SITE_URL}/cancel`,
    metadata: { cart: JSON.stringify(parsed.data.items).slice(0, 450) },
  });

  return NextResponse.json({ url: session.url });
}
