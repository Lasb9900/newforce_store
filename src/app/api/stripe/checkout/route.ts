import Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripeCheckoutSchema } from "@/lib/schemas";
import { getServerSupabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { calculateShippingCents, calculateTaxCents, validateCartItems } from "@/lib/checkout";

export async function POST(req: Request) {
  const parsed = stripeCheckoutSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  try {
    const sb = await getServerSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();

    const validatedCart = await validateCartItems(sb, parsed.data.items);
    const shippingCents = calculateShippingCents(validatedCart.subtotal_cents);
    const taxCents = calculateTaxCents();
    const totalCents = validatedCart.subtotal_cents + shippingCents + taxCents;

    const { data: order, error: orderError } = await sb
      .from("orders")
      .insert({
        user_id: user?.id ?? null,
        buyer_email: parsed.data.shipping.email,
        buyer_name: parsed.data.shipping.full_name,
        buyer_phone: parsed.data.shipping.phone,
        email: parsed.data.shipping.email,
        full_name: parsed.data.shipping.full_name,
        phone: parsed.data.shipping.phone,
        subtotal_cents: validatedCart.subtotal_cents,
        shipping_cents: shippingCents,
        tax_cents: taxCents,
        total_cents: totalCents,
        status: "pending",
        payment_status: "pending",
        currency: "USD",
        shipping_address: {
          line1: parsed.data.shipping.address_line_1,
          line2: parsed.data.shipping.address_line_2 || null,
          city: parsed.data.shipping.city,
          state: parsed.data.shipping.state,
          postal_code: parsed.data.shipping.postal_code,
          country: parsed.data.shipping.country,
          delivery_notes: parsed.data.shipping.delivery_notes || null,
        },
        shipping_address_line_1: parsed.data.shipping.address_line_1,
        shipping_city: parsed.data.shipping.city,
        shipping_state: parsed.data.shipping.state,
        shipping_postal_code: parsed.data.shipping.postal_code,
        shipping_country: parsed.data.shipping.country,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message ?? "No se pudo crear la orden preliminar" }, { status: 500 });
    }

    const { error: orderItemsError } = await sb.from("order_items").insert(
      validatedCart.items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        qty: item.quantity,
        quantity: item.quantity,
        unit_price_cents_snapshot: item.unit_price_cents,
        unit_price_cents: item.unit_price_cents,
        line_total_cents: item.line_total_cents,
        name_snapshot: item.product_name_snapshot,
        product_name_snapshot: item.product_name_snapshot,
      })),
    );

    if (orderItemsError) {
      return NextResponse.json({ error: orderItemsError.message }, { status: 500 });
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = validatedCart.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: "usd",
        unit_amount: item.unit_price_cents,
        product_data: { name: item.product_name_snapshot },
      },
    }));

    if (shippingCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: shippingCents,
          product_data: { name: "Standard Shipping" },
        },
      });
    }

    const successUrl = env.STRIPE_SUCCESS_URL ?? `${env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = env.STRIPE_CANCEL_URL ?? `${env.NEXT_PUBLIC_SITE_URL}/cancel`;

    const session = await stripe.checkout.sessions.create({
      client_reference_id: user?.id,
      mode: "payment",
      line_items: lineItems,
      customer_email: parsed.data.shipping.email,
      shipping_address_collection: { allowed_countries: ["US"] },
      phone_number_collection: { enabled: true },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        order_id: order.id,
        shipping_option_id: parsed.data.shipping_option_id,
      },
    });

    const { error: updateOrderError } = await sb
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    if (updateOrderError) {
      return NextResponse.json({ error: updateOrderError.message }, { status: 500 });
    }

    await sb.from("order_events").insert({ order_id: order.id, event_type: "checkout_session_created", payload: { stripe_session_id: session.id } });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || "Stripe checkout failed" }, { status: 500 });
  }
}
