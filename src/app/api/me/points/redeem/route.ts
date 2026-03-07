import { NextResponse } from "next/server";
import { redeemPointsSchema } from "@/lib/schemas";
import { requireUserApi } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const auth = await requireUserApi();
  if ("error" in auth) return auth.error;

  const parsed = redeemPointsSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = getServiceSupabase();
  const { data: product } = await admin
    .from("products")
    .select("id,name,points_price,redeemable,base_stock")
    .eq("id", parsed.data.productId)
    .single();

  if (!product?.redeemable || !product.points_price) {
    return NextResponse.json({ error: "Producto no redimible" }, { status: 400 });
  }

  if (product.base_stock < parsed.data.qty) {
    return NextResponse.json({ error: "Sin stock" }, { status: 400 });
  }

  const totalPoints = product.points_price * parsed.data.qty;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: auth.user.id,
      buyer_email: auth.user.email,
      buyer_name: [auth.profile?.first_name, auth.profile?.last_name].filter(Boolean).join(" ") || null,
      buyer_phone: auth.profile?.phone ?? null,
      status: "paid",
      payment_status: "paid",
      payment_method: "points",
      subtotal_cents: 0,
      total_cents: 0,
      points_redeemed: totalPoints,
      points_earned: 0,
      channel: "online",
      currency: "USD",
    })
    .select("id")
    .single();

  if (orderError || !order) return NextResponse.json({ error: orderError?.message || "No se pudo crear orden" }, { status: 500 });

  const { error: stockError } = await admin
    .from("products")
    .update({ base_stock: product.base_stock - parsed.data.qty })
    .eq("id", product.id)
    .gte("base_stock", parsed.data.qty);

  if (stockError) return NextResponse.json({ error: stockError.message }, { status: 400 });

  await admin.from("order_items").insert({
    order_id: order.id,
    product_id: product.id,
    name_snapshot: product.name,
    unit_price_cents_snapshot: 0,
    qty: parsed.data.qty,
    points_price_snapshot: product.points_price,
  });

  const { error: redeemError } = await admin.rpc("redeem_points_for_order", {
    p_user_id: auth.user.id,
    p_points: totalPoints,
    p_order_id: order.id,
    p_description: `Redención de ${product.name}`,
    p_created_by: auth.user.id,
  });

  if (redeemError) return NextResponse.json({ error: redeemError.message }, { status: 400 });

  return NextResponse.json({ ok: true, orderId: order.id });
}
