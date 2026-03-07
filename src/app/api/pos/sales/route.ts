import { NextResponse } from "next/server";
import { createPosSaleSchema } from "@/lib/schemas";
import { requireSellerApi } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const auth = await requireSellerApi();
  if ("error" in auth) return auth.error;

  const parsed = createPosSaleSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = getServiceSupabase();
  let customerId: string | null = null;
  let customerEmail: string | null = null;

  if (parsed.data.customerEmail) {
    const { data: profile } = await admin
      .from("profiles")
      .select("user_id,email")
      .ilike("email", parsed.data.customerEmail)
      .maybeSingle();
    customerId = profile?.user_id ?? null;
    customerEmail = profile?.email ?? parsed.data.customerEmail;
  }

  const item = parsed.data.items[0];
  const { data: product } = await admin.from("products").select("id,name,base_price_cents,base_stock").eq("id", item.productId).single();
  if (!product?.base_price_cents) return NextResponse.json({ error: "Producto inválido" }, { status: 400 });
  if (product.base_stock < item.qty) return NextResponse.json({ error: "Stock insuficiente" }, { status: 400 });

  const totalCents = product.base_price_cents * item.qty;
  const pointsEarned = customerId ? Math.floor(totalCents / 100) : 0;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: customerId,
      sold_by: auth.user.id,
      buyer_email: customerEmail,
      status: "paid",
      payment_status: "paid",
      payment_method: parsed.data.paymentMethod,
      subtotal_cents: totalCents,
      total_cents: totalCents,
      currency: "USD",
      channel: "physical_store",
      points_earned: pointsEarned,
    })
    .select("id")
    .single();

  if (orderError || !order) return NextResponse.json({ error: orderError?.message || "Error creando venta" }, { status: 500 });

  await admin.from("order_items").insert({
    order_id: order.id,
    product_id: product.id,
    name_snapshot: product.name,
    unit_price_cents_snapshot: product.base_price_cents,
    qty: item.qty,
  });

  const { error: stockError } = await admin
    .from("products")
    .update({ base_stock: product.base_stock - item.qty })
    .eq("id", product.id)
    .gte("base_stock", item.qty);

  if (stockError) return NextResponse.json({ error: stockError.message }, { status: 400 });

  if (customerId && pointsEarned > 0) {
    await admin.rpc("add_points", {
      p_user_id: customerId,
      p_points: pointsEarned,
      p_order_id: order.id,
      p_description: `Puntos por venta física ${order.id}`,
      p_created_by: auth.user.id,
    });
  }

  return NextResponse.json({ ok: true, orderId: order.id, pointsEarned });
}
