import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { getServiceSupabase } from "@/lib/supabase";
import { processLoyaltyAccrual } from "@/lib/services/loyalty.service";

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

  const { data: order, error: findOrderError } = await admin
    .from("orders")
    .select("id,status,payment_status,total_cents,user_id,buyer_email,email")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (findOrderError || !order) {
    return NextResponse.json({ error: findOrderError?.message ?? "Order not found for session" }, { status: 404 });
  }

  if (order.status === "paid" && order.payment_status === "paid") {
    return NextResponse.json({ received: true, idempotent: true });
  }

  const { error: markPaidError } = await admin
    .from("orders")
    .update({
      status: "paid",
      payment_status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (markPaidError) {
    return NextResponse.json({ error: markPaidError.message }, { status: 500 });
  }

  const { data: orderItems, error: orderItemsError } = await admin
    .from("order_items")
    .select("id,product_id,variant_id,quantity,qty")
    .eq("order_id", order.id);

  if (orderItemsError) {
    return NextResponse.json({ error: orderItemsError.message }, { status: 500 });
  }

  for (const item of orderItems ?? []) {
    const qty = Number(item.quantity ?? item.qty ?? 0);
    if (!qty || qty < 1) continue;

    if (item.variant_id) {
      await admin.rpc("decrement_variant_stock", { variant_id: item.variant_id, qty });
    } else {
      await admin.rpc("decrement_product_stock", { product_id: item.product_id, qty });
    }
  }

  await admin.from("order_events").insert({
    order_id: order.id,
    event_type: "checkout_session_completed",
    payload: { stripe_session_id: session.id },
  });

  await processLoyaltyAccrual({
    sourceType: "online_order",
    sourceId: order.id,
    amountCents: Number(order.total_cents ?? 0),
    userId: order.user_id ?? null,
    email: order.buyer_email ?? order.email ?? null,
    metadata: {
      channel: "online",
      stripe_session_id: session.id,
    },
  });

  return NextResponse.json({ received: true });
}
