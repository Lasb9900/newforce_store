import { NextResponse } from "next/server";
import { createCheckoutSchema } from "@/lib/schemas";
import { createSupabaseServer } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import Stripe from "stripe";

export async function POST(req: Request) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  const parsed = createCheckoutSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const sb = await createSupabaseServer();
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  for (const item of parsed.data.items) {
    if (item.variantId) {
      const { data: variant } = await sb.from("product_variants").select("*, products(name,currency)").eq("id", item.variantId).single();
      if (!variant?.active || variant.stock < item.qty) return NextResponse.json({ error: "Invalid stock variant" }, { status: 400 });
      line_items.push({ quantity: item.qty, price_data: { currency: variant.products.currency.toLowerCase(), unit_amount: variant.price_cents, product_data: { name: `${variant.products.name} - ${variant.variant_name}` } } });
    } else if (item.productId) {
      const { data: product } = await sb.from("products").select("*").eq("id", item.productId).single();
      if (!product?.active || product.base_stock < item.qty) return NextResponse.json({ error: "Invalid stock product" }, { status: 400 });
      line_items.push({ quantity: item.qty, price_data: { currency: product.currency.toLowerCase(), unit_amount: product.base_price_cents, product_data: { name: product.name } } });
    }
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items,
    shipping_address_collection: { allowed_countries: ["US"] },
    phone_number_collection: { enabled: true },
    success_url: env.STRIPE_SUCCESS_URL ?? `${env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: env.STRIPE_CANCEL_URL ?? `${env.NEXT_PUBLIC_SITE_URL}/cancel`,
    metadata: { cart: JSON.stringify(parsed.data.items) },
  });
  return NextResponse.json({ url: session.url });
}
