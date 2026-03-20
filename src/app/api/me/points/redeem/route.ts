import { NextResponse } from "next/server";
import { redeemPointsSchema } from "@/lib/schemas";
import { requireUserApi } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { sendOrderConfirmationEmailIfNeeded } from "@/lib/email";

export async function POST(req: Request) {
  const auth = await requireUserApi();
  if ("error" in auth) return auth.error;

  const parsed = redeemPointsSchema.safeParse(await req.json());

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    const readableError =
      flattened.formErrors[0] ||
      Object.values(flattened.fieldErrors).flat()[0] ||
      "Solicitud inválida";

    return NextResponse.json({ error: readableError }, { status: 400 });
  }

  const admin = getServiceSupabase();

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id,name,points_price,redeemable,base_stock,active")
    .eq("id", parsed.data.productId)
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  if (!product.active) {
    return NextResponse.json({ error: "Producto inactivo" }, { status: 400 });
  }

  if (!product.redeemable || !product.points_price) {
    return NextResponse.json({ error: "Producto no redimible" }, { status: 400 });
  }

  if (product.base_stock < parsed.data.qty) {
    return NextResponse.json({ error: "Sin stock" }, { status: 400 });
  }

  const totalPoints = product.points_price * parsed.data.qty;

  const { data: customerPoints, error: pointsError } = await admin
    .from("customer_points")
    .select("balance")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (pointsError) {
    return NextResponse.json({ error: pointsError.message }, { status: 400 });
  }

  let availablePoints = Number(customerPoints?.balance ?? 0);

  if (!customerPoints) {
    const { data: loyaltyTx, error: loyaltyError } = await admin
      .from("loyalty_transactions")
      .select("points_delta,status")
      .eq("user_id", auth.user.id)
      .eq("status", "applied");

    if (loyaltyError) {
      return NextResponse.json({ error: loyaltyError.message }, { status: 400 });
    }

    availablePoints = (loyaltyTx ?? []).reduce(
      (sum, tx) => sum + Number(tx.points_delta ?? 0),
      0,
    );

    const { error: seedError } = await admin.from("customer_points").upsert(
      {
        user_id: auth.user.id,
        balance: availablePoints,
      },
      { onConflict: "user_id" },
    );

    if (seedError) {
      return NextResponse.json({ error: seedError.message }, { status: 400 });
    }
  }

  if (availablePoints < totalPoints) {
    return NextResponse.json({ error: "No tienes puntos suficientes" }, { status: 400 });
  }

  const shipping = parsed.data.shipping;

  const shippingAddress = {
    full_name: shipping.full_name,
    email: shipping.email,
    phone: shipping.phone,
    line1: shipping.address_line_1,
    line2: shipping.address_line_2 || null,
    city: shipping.city,
    state: shipping.state,
    postal_code: shipping.postal_code,
    country: shipping.country,
    delivery_notes: shipping.delivery_notes || null,
  };

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: auth.user.id,
      buyer_email: shipping.email,
      buyer_name: shipping.full_name,
      buyer_phone: shipping.phone,
      status: "paid",
      payment_status: "paid",
      payment_method: "points",
      subtotal_cents: 0,
      total_cents: 0,
      points_redeemed: totalPoints,
      points_earned: 0,
      channel: "online",
      currency: "USD",
      shipping_address: shippingAddress,
      shipping_cents: 0,
      tax_cents: 0,
      discount_cents: 0,
      shipping_address_line_1: shipping.address_line_1,
      shipping_address_line_2: shipping.address_line_2 || null,
      shipping_city: shipping.city,
      shipping_state: shipping.state,
      shipping_postal_code: shipping.postal_code,
      shipping_country: shipping.country,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      { error: orderError?.message || "No se pudo crear orden" },
      { status: 500 },
    );
  }

  const { error: stockError } = await admin
    .from("products")
    .update({ base_stock: product.base_stock - parsed.data.qty })
    .eq("id", product.id)
    .gte("base_stock", parsed.data.qty);

  if (stockError) {
    await admin.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: stockError.message }, { status: 400 });
  }

  const { error: itemError } = await admin.from("order_items").insert({
    order_id: order.id,
    product_id: product.id,
    name_snapshot: product.name,
    unit_price_cents_snapshot: 0,
    qty: parsed.data.qty,
    points_price_snapshot: product.points_price,
  });

  if (itemError) {
    await admin.from("products").update({ base_stock: product.base_stock }).eq("id", product.id);
    await admin.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: itemError.message }, { status: 400 });
  }

  const { error: redeemError } = await admin.rpc("redeem_points_for_order", {
    p_user_id: auth.user.id,
    p_points: totalPoints,
    p_order_id: order.id,
    p_description: `Redención de ${product.name}`,
    p_created_by: auth.user.id,
  });

  if (redeemError) {
    await admin.from("order_items").delete().eq("order_id", order.id);
    await admin.from("products").update({ base_stock: product.base_stock }).eq("id", product.id);
    await admin.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: redeemError.message }, { status: 400 });
  }

  const newBalance = Math.max(0, availablePoints - totalPoints);

  const { error: syncError } = await admin.from("customer_points").upsert(
    {
      user_id: auth.user.id,
      balance: newBalance,
    },
    { onConflict: "user_id" },
  );

  if (syncError) {
    return NextResponse.json({ error: syncError.message }, { status: 400 });
  }

  try {
    await sendOrderConfirmationEmailIfNeeded(order.id);
  } catch (error) {
    console.error("[POINTS_REDEEM][ORDER_CONFIRMATION_EMAIL_ERROR]", {
      orderId: order.id,
      error,
    });
  }

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    balance: newBalance,
  });
}