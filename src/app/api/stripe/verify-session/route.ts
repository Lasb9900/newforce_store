import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { serverEnv } from "@/lib/server-env";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getPaymentIntentId(
  session: Stripe.Checkout.Session
): string | null {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : null;
}

export async function GET(req: NextRequest) {
  try {
    if (!stripe || !serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Stripe/Supabase not configured" },
        { status: 500 }
      );
    }

    const sessionId = req.nextUrl.searchParams.get("session_id")?.trim();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session_id" },
        { status: 400 }
      );
    }

    let session: Stripe.Checkout.Session;

    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      console.error("[VERIFY_SESSION][STRIPE_RETRIEVE_ERROR]", error);
      return NextResponse.json(
        { error: "Invalid or unknown Stripe session" },
        { status: 400 }
      );
    }

    const admin = getServiceSupabase();

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select(
        "id,status,payment_status,total_cents,user_id,buyer_email,stripe_session_id"
      )
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    if (orderError) {
      console.error("[VERIFY_SESSION][ORDER_LOOKUP_ERROR]", orderError);
      return NextResponse.json(
        { error: orderError.message },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        {
          ok: false,
          sessionId: session.id,
          stripePaymentStatus: session.payment_status ?? null,
          status: "not_found",
          message: "Order not found for this Stripe session",
        },
        { status: 404 }
      );
    }

    const paidInDb =
      order.status === "paid" && order.payment_status === "paid";
    const paidInStripe = session.payment_status === "paid";

    let status: "paid" | "processing" | "pending" = "pending";

    if (paidInDb) {
      status = "paid";
    } else if (paidInStripe) {
      status = "processing";
    }

    return NextResponse.json(
      {
        ok: true,
        status,
        orderId: order.id,
        sessionId: session.id,
        stripePaymentStatus: session.payment_status ?? null,
        paymentIntentId: getPaymentIntentId(session),
        orderStatus: order.status ?? null,
        orderPaymentStatus: order.payment_status ?? null,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("[VERIFY_SESSION][UNHANDLED_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to verify session" },
      { status: 500 }
    );
  }
}