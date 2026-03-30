import { NextResponse } from "next/server";
import { stripeCheckoutSchema } from "@/lib/schemas";
import { getServerSupabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { validateCartItems } from "@/lib/checkout";
import { calculateTaxCents, resolveShippingOption } from "@/lib/shipping";
import { getShippingOptions } from "@/lib/services/shipping.service";
import { buildCheckoutPricing } from "@/lib/services/checkout-pricing.service";
import { buildStripeLineItems } from "@/lib/services/stripe-checkout.service";
import { loadUserCart } from "@/lib/cart-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const parsed = stripeCheckoutSchema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  try {
    const sb = await getServerSupabase();

    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "AUTH_REQUIRED",
          message: "You must sign in or register to continue with checkout.",
        },
        { status: 401 }
      );
    }

    const cartInput = (await loadUserCart(sb, user.id)).items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      qty: item.qty,
    }));

    const validatedCart = await validateCartItems(sb, cartInput);

    const { options: shippingOptions } = await getShippingOptions({
      subtotalCents: validatedCart.subtotal_cents,
      destinationPostalCode: parsed.data.shipping.postal_code,
      destinationState: parsed.data.shipping.state,
      destinationCountry: parsed.data.shipping.country,
      weightGrams: validatedCart.total_weight_grams,
    });

    const selectedShipping = resolveShippingOption(
      shippingOptions,
      parsed.data.shipping_option_id
    );

    if (!selectedShipping) {
      return NextResponse.json(
        { error: "Selected shipping option is no longer available" },
        { status: 400 }
      );
    }

    const pricing = buildCheckoutPricing({
      cart: validatedCart,
      shippingCents: selectedShipping.amount_cents,
      taxCents: calculateTaxCents(),
      discountCents: 0,
    });

    const shippingAddress = {
      line1: parsed.data.shipping.address_line_1,
      line2: parsed.data.shipping.address_line_2 || null,
      city: parsed.data.shipping.city,
      state: parsed.data.shipping.state,
      postal_code: parsed.data.shipping.postal_code,
      country: parsed.data.shipping.country,
      delivery_notes: parsed.data.shipping.delivery_notes || null,
      shipping_option_id: parsed.data.shipping_option_id,
      shipping_option_name: selectedShipping.name,
      shipping_cents: pricing.shipping_cents,
      tax_cents: pricing.tax_cents,
    };

    const { data: order, error: orderError } = await sb
      .from("orders")
      .insert({
        user_id: user.id,
        buyer_email: parsed.data.shipping.email,
        buyer_name: parsed.data.shipping.full_name,
        buyer_phone: parsed.data.shipping.phone,
        subtotal_cents: pricing.subtotal_cents,
        total_cents: pricing.total_cents,
        status: "pending",
        payment_status: "pending",
        currency: "USD",
        shipping_address: shippingAddress,
        shipping_cents: pricing.shipping_cents,
        tax_cents: pricing.tax_cents,
        discount_cents: 0,
        shipping_address_line_1: parsed.data.shipping.address_line_1,
        shipping_address_line_2: parsed.data.shipping.address_line_2 || null,
        shipping_city: parsed.data.shipping.city,
        shipping_state: parsed.data.shipping.state,
        shipping_postal_code: parsed.data.shipping.postal_code,
        shipping_country: parsed.data.shipping.country,
        channel: "online",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("[STRIPE_CHECKOUT][ORDER_INSERT_ERROR]", orderError);

      return NextResponse.json(
        {
          error:
            orderError?.message ?? "Unable to create preliminary order",
        },
        { status: 500 }
      );
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
        name_snapshot: item.product_name_snapshot,
        product_name_snapshot: item.product_name_snapshot,
      }))
    );

    if (orderItemsError) {
      console.error(
        "[STRIPE_CHECKOUT][ORDER_ITEMS_INSERT_ERROR]",
        orderItemsError
      );

      return NextResponse.json(
        { error: orderItemsError.message },
        { status: 500 }
      );
    }

    const lineItems = buildStripeLineItems({
      cart: validatedCart,
      shippingName: selectedShipping.name,
      shippingCents: pricing.shipping_cents,
    });

    const successUrl =
      env.STRIPE_SUCCESS_URL ??
      `${env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      env.STRIPE_CANCEL_URL ??
      `${env.NEXT_PUBLIC_SITE_URL}/cancel`;

    const session = await stripe.checkout.sessions.create({
      client_reference_id: user.id,
      mode: "payment",
      line_items: lineItems,
      customer_email: parsed.data.shipping.email,
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      phone_number_collection: {
        enabled: true,
      },
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
      console.error("[STRIPE_CHECKOUT][ORDER_UPDATE_ERROR]", updateOrderError);

      return NextResponse.json(
        { error: updateOrderError.message },
        { status: 500 }
      );
    }

    const { error: orderEventError } = await sb.from("order_events").insert({
      order_id: order.id,
      event_type: "checkout_session_created",
      payload: { stripe_session_id: session.id },
    });

    if (orderEventError) {
      console.error(
        "[STRIPE_CHECKOUT][ORDER_EVENT_INSERT_ERROR]",
        orderEventError
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[STRIPE_CHECKOUT][UNEXPECTED_ERROR]", error);

    return NextResponse.json(
      { error: "Unable to start secure payment" },
      { status: 500 }
    );
  }
}