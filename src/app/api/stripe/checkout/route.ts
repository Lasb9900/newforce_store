import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { getServiceSupabase } from "@/lib/supabase";
import { processLoyaltyAccrual } from "@/lib/services/loyalty.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  console.log("[STRIPE_WEBHOOK][GET_HIT][/api/stripe/webhook]");
  return NextResponse.json({
    ok: true,
    route: "stripe-webhook",
    hasStripe: Boolean(stripe),
    hasWebhookSecret: Boolean(env.STRIPE_WEBHOOK_SECRET),
    hasServiceRole: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
  });
}

export async function POST(req: Request) {
  console.log("[STRIPE_WEBHOOK][POST_HIT][/api/stripe/webhook]");

  try {
    if (!stripe || !env.STRIPE_WEBHOOK_SECRET || !env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[STRIPE_WEBHOOK][CONFIG_ERROR]", {
        hasStripe: Boolean(stripe),
        hasWebhookSecret: Boolean(env.STRIPE_WEBHOOK_SECRET),
        hasServiceRole: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      });

      return NextResponse.json(
        { error: "Stripe/Supabase not configured" },
        { status: 500 }
      );
    }

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    console.log("[STRIPE_WEBHOOK][BODY_RECEIVED]", { length: body.length });
    console.log("[STRIPE_WEBHOOK][HEADERS_DUMP]", {
      stripeSignaturePresent: Boolean(signature),
      contentType: req.headers.get("content-type"),
      userAgent: req.headers.get("user-agent"),
    });

    if (!signature) {
      console.error("[STRIPE_WEBHOOK][MISSING_SIGNATURE]");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );

      console.log("[STRIPE_WEBHOOK][EVENT_CONSTRUCTED]", {
        id: event.id,
        type: event.type,
      });
    } catch (error) {
      console.error("[STRIPE_WEBHOOK][SIGNATURE_ERROR]", error);
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 400 }
      );
    }

    if (event.type !== "checkout.session.completed") {
      console.log("[STRIPE_WEBHOOK][IGNORED_EVENT]", { type: event.type });
      return NextResponse.json({ received: true, ignored: true });
    }

    const session = event.data.object;
    const admin = getServiceSupabase();

    console.log("[STRIPE_WEBHOOK][SESSION_COMPLETED]", {
      sessionId: session.id,
      paymentIntent:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null,
    });

    const { data: order, error: findOrderError } = await admin
      .from("orders")
      .select("id,status,payment_status,total_cents,user_id,buyer_email,stripe_session_id")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    if (findOrderError) {
      console.error("[STRIPE_WEBHOOK][FIND_ORDER_ERROR]", findOrderError);
      return NextResponse.json(
        { error: findOrderError.message },
        { status: 500 }
      );
    }

    if (!order) {
      console.error("[STRIPE_WEBHOOK][ORDER_NOT_FOUND]", {
        stripe_session_id: session.id,
      });
      return NextResponse.json(
        { error: "Order not found for session" },
        { status: 404 }
      );
    }

    console.log("[STRIPE_WEBHOOK][ORDER_FOUND]", {
      orderId: order.id,
      status: order.status,
      paymentStatus: order.payment_status,
    });

    if (order.status === "paid" && order.payment_status === "paid") {
      console.log("[STRIPE_WEBHOOK][IDEMPOTENT_SUCCESS]", { orderId: order.id });
      return NextResponse.json({ received: true, idempotent: true });
    }

    const { error: markPaidError } = await admin
      .from("orders")
      .update({
        status: "paid",
        payment_status: "paid",
        stripe_payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
        payment_method: "stripe",
      })
      .eq("id", order.id);

    if (markPaidError) {
      console.error("[STRIPE_WEBHOOK][MARK_PAID_ERROR]", markPaidError);
      return NextResponse.json(
        { error: markPaidError.message },
        { status: 500 }
      );
    }

    console.log("[STRIPE_WEBHOOK][ORDER_MARKED_PAID]", { orderId: order.id });

    const { data: orderItems, error: orderItemsError } = await admin
      .from("order_items")
      .select("id,product_id,variant_id,quantity,qty")
      .eq("order_id", order.id);

    if (orderItemsError) {
      console.error("[STRIPE_WEBHOOK][ORDER_ITEMS_ERROR]", orderItemsError);
      return NextResponse.json(
        { error: orderItemsError.message },
        { status: 500 }
      );
    }

    for (const item of orderItems ?? []) {
      const qty = Number(item.quantity ?? item.qty ?? 0);
      if (!qty || qty < 1) continue;

      if (item.variant_id) {
        const { error } = await admin.rpc("decrement_variant_stock", {
          variant_id: item.variant_id,
          qty,
        });

        if (error) {
          console.error("[STRIPE_WEBHOOK][DECREMENT_VARIANT_ERROR]", error, item);
        }
      } else {
        const { error } = await admin.rpc("decrement_product_stock", {
          product_id: item.product_id,
          qty,
        });

        if (error) {
          console.error("[STRIPE_WEBHOOK][DECREMENT_PRODUCT_ERROR]", error, item);
        }
      }
    }

    const { error: orderEventError } = await admin.from("order_events").insert({
      order_id: order.id,
      event_type: "checkout_session_completed",
      payload: {
        stripe_session_id: session.id,
        stripe_payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
      },
    });

    if (orderEventError) {
      console.error("[STRIPE_WEBHOOK][ORDER_EVENT_ERROR]", orderEventError);
    }

    if (order.user_id) {
      const { data: userCart, error: cartLookupError } = await admin
        .from("carts")
        .select("id")
        .eq("user_id", order.user_id)
        .maybeSingle();

      if (cartLookupError) {
        console.error("[STRIPE_WEBHOOK][CART_LOOKUP_ERROR]", cartLookupError);
      } else if (userCart?.id) {
        const { error: deleteCartItemsError } = await admin
          .from("cart_items")
          .delete()
          .eq("cart_id", userCart.id);

        if (deleteCartItemsError) {
          console.error(
            "[STRIPE_WEBHOOK][DELETE_CART_ITEMS_ERROR]",
            deleteCartItemsError
          );
        }
      }
    }

    try {
      await processLoyaltyAccrual({
        sourceType: "online_order",
        sourceId: order.id,
        amountCents: Number(order.total_cents ?? 0),
        userId: order.user_id ?? null,
        email: order.buyer_email ?? null,
        metadata: {
          channel: "online",
          stripe_session_id: session.id,
        },
      });
    } catch (error) {
      console.error("[STRIPE_WEBHOOK][LOYALTY_ERROR]", error);
    }

    console.log("[STRIPE_WEBHOOK][SUCCESS]", { orderId: order.id });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[STRIPE_WEBHOOK][UNHANDLED_ERROR]", error);
    return NextResponse.json(
      { error: "Unhandled webhook failure" },
      { status: 500 }
    );
  }
}