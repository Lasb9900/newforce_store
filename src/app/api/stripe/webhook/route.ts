import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Stripe/Supabase not configured" }, { status: 500 });
  }

  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  const admin = getServiceSupabase();

  const { data: existingOrder } = await admin
    .from("orders")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (existingOrder) {
    return NextResponse.json({ received: true, idempotent: true });
  }

  const items = JSON.parse((session.metadata?.cart as string) || "[]") as Array<{ productId?: string; variantId?: string; qty: number }>;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: session.client_reference_id || null,
      buyer_email: session.customer_details?.email ?? null,
      buyer_name: session.customer_details?.name ?? null,
      buyer_phone: session.customer_details?.phone ?? null,
      status: "paid",
      subtotal_cents: Number(session.amount_subtotal ?? 0),
      total_cents: Number(session.amount_total ?? 0),
      currency: String(session.currency || "usd").toUpperCase(),
      stripe_session_id: session.id,
      stripe_payment_intent_id: String(session.payment_intent || ""),
      shipping_address: session.customer_details?.address ?? null,
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? "Cannot create order" }, { status: 500 });
  }

  for (const item of items) {
    if (item.variantId) {
      const { data: variant } = await admin
        .from("product_variants")
        .select("id,product_id,variant_name,price_cents,products(name)")
        .eq("id", item.variantId)
        .single();

      if (!variant) continue;

      const variantProduct = Array.isArray(variant.products) ? variant.products[0] : variant.products;

      await admin.from("order_items").insert({
        order_id: order.id,
        product_id: variant.product_id,
        variant_id: variant.id,
        name_snapshot: variantProduct?.name ?? "Variant",
        variant_snapshot: variant.variant_name,
        unit_price_cents_snapshot: variant.price_cents,
        qty: item.qty,
      });

      await admin.rpc("decrement_variant_stock", { variant_id: variant.id, qty: item.qty });
    } else if (item.productId) {
      const { data: product } = await admin.from("products").select("id,name,base_price_cents").eq("id", item.productId).single();
      if (!product) continue;

      await admin.from("order_items").insert({
        order_id: order.id,
        product_id: product.id,
        name_snapshot: product.name,
        unit_price_cents_snapshot: product.base_price_cents,
        qty: item.qty,
      });

      await admin.rpc("decrement_product_stock", { product_id: product.id, qty: item.qty });
    }
  }

  return NextResponse.json({ received: true });
}
