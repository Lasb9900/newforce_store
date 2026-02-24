import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  if (!stripe || !supabaseAdmin || !env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Not configured" }, { status: 500 });
  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  let event;
  try { event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET); } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const existing = await supabaseAdmin.from("orders").select("id").eq("stripe_session_id", session.id).single();
    if (!existing.data) {
      const items = JSON.parse((session.metadata?.cart as string) || "[]");
      const subtotal = Number(session.amount_subtotal ?? 0);
      const total = Number(session.amount_total ?? 0);
      const { data: order } = await supabaseAdmin.from("orders").insert({
        user_id: session.client_reference_id || null,
        buyer_email: session.customer_details?.email,
        buyer_name: session.customer_details?.name,
        buyer_phone: session.customer_details?.phone,
        status: "paid",
        subtotal_cents: subtotal,
        total_cents: total,
        currency: (session.currency || "usd").toUpperCase(),
        stripe_session_id: session.id,
        stripe_payment_intent_id: String(session.payment_intent || ""),
        shipping_address: session.customer_details?.address,
      }).select().single();
      for (const item of items) {
        if (item.variantId) {
          const { data: variant } = await supabaseAdmin.from("product_variants").select("*, products(name,id)").eq("id", item.variantId).single();
          if (!variant) continue;
          await supabaseAdmin.from("order_items").insert({ order_id: order!.id, product_id: variant.product_id, variant_id: variant.id, name_snapshot: variant.products.name, variant_snapshot: variant.variant_name, unit_price_cents_snapshot: variant.price_cents, qty: item.qty });
          await supabaseAdmin.rpc("decrement_variant_stock", { variant_id: variant.id, qty: item.qty });
        } else {
          const { data: product } = await supabaseAdmin.from("products").select("*").eq("id", item.productId).single();
          if (!product) continue;
          await supabaseAdmin.from("order_items").insert({ order_id: order!.id, product_id: product.id, name_snapshot: product.name, unit_price_cents_snapshot: product.base_price_cents, qty: item.qty });
          await supabaseAdmin.rpc("decrement_product_stock", { product_id: product.id, qty: item.qty });
        }
      }
    }
  }
  return NextResponse.json({ received: true });
}
