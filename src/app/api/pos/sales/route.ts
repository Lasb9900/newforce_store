import { NextResponse } from "next/server";
import { createPosSaleSchema } from "@/lib/schemas";
import { requireSellerApi } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { env } from "@/lib/env";

const VALID_PAYMENT_METHODS = new Set(["cash", "card", "transfer"]);

function isInvalidApiKeyError(message: string | undefined) {
  return (message ?? "").toLowerCase().includes("invalid api key");
}

export async function POST(req: Request) {
  const auth = await requireSellerApi();
  if ("error" in auth) return auth.error;

  const parsed = createPosSaleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const paymentMethod = parsed.data.paymentMethod;
  const paymentReference = parsed.data.paymentReference?.trim() || null;

  if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
    return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });
  }

  if (paymentMethod === "transfer" && !paymentReference) {
    return NextResponse.json({ error: "Debe ingresar la referencia de la transferencia" }, { status: 400 });
  }

  if (paymentMethod === "card" && !paymentReference) {
    return NextResponse.json({ error: "Debe ingresar la referencia del pago con tarjeta" }, { status: 400 });
  }

  if (paymentMethod !== "cash" && !env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Falta STRIPE_SECRET_KEY para pagos digitales" }, { status: 400 });
  }

  const item = parsed.data.items[0];
  if (!item?.productId) return NextResponse.json({ error: "Producto no informado" }, { status: 400 });
  if (!item?.qty || item.qty <= 0) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });

  const db = auth.supabase;
  let service: ReturnType<typeof getServiceSupabase> | null = null;
  try {
    service = getServiceSupabase();
  } catch {
    service = null;
  }

  let customerId: string | null = null;
  let customerEmail: string | null = parsed.data.customerEmail ?? null;

  if (parsed.data.customerEmail && service) {
    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("user_id,email")
      .ilike("email", parsed.data.customerEmail)
      .maybeSingle();

    if (!profileError) {
      customerId = profile?.user_id ?? null;
      customerEmail = profile?.email ?? parsed.data.customerEmail;
    }
  }

  const { data: product, error: productError } = await db
    .from("products")
    .select("id,name,active,price_cents,base_price_cents,qty,base_stock")
    .eq("id", item.productId)
    .maybeSingle();

  if (productError) {
    if (isInvalidApiKeyError(productError.message)) {
      return NextResponse.json(
        { error: "Configuración de Supabase inválida (API key). Revisa NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: `No se pudo validar producto: ${productError.message}` }, { status: 400 });
  }
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  if (!product.active) return NextResponse.json({ error: "Producto inactivo" }, { status: 400 });

  const priceCents = product.price_cents ?? product.base_price_cents;
  const stock = product.qty ?? product.base_stock ?? 0;

  if (priceCents == null || priceCents < 0) {
    return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
  }

  if (stock < item.qty) {
    return NextResponse.json({ error: `Stock insuficiente. Disponible: ${stock}` }, { status: 400 });
  }

  const totalCents = priceCents * item.qty;
  const pointsEarned = customerId ? Math.floor(totalCents / 100) : 0;

  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      user_id: customerId,
      sold_by: auth.user.id,
      buyer_email: customerEmail,
      status: "paid",
      payment_status: "paid",
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      subtotal_cents: totalCents,
      total_cents: totalCents,
      currency: "USD",
      channel: "physical_store",
      points_earned: pointsEarned,
    })
    .select("id,created_at")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message || "No se pudo registrar la venta" }, { status: 500 });
  }

  const { error: itemError } = await db.from("order_items").insert({
    order_id: order.id,
    product_id: product.id,
    name_snapshot: product.name,
    unit_price_cents_snapshot: priceCents,
    qty: item.qty,
  });

  if (itemError) {
    return NextResponse.json({ error: `No se pudo registrar el detalle de venta: ${itemError.message}` }, { status: 500 });
  }

  const { error: stockError } = await db
    .from("products")
    .update({ base_stock: stock - item.qty, qty: stock - item.qty })
    .eq("id", product.id)
    .gte("qty", item.qty);

  if (stockError) return NextResponse.json({ error: `No se pudo actualizar stock: ${stockError.message}` }, { status: 400 });

  if (customerId && pointsEarned > 0 && service) {
    await service.rpc("add_points", {
      p_user_id: customerId,
      p_points: pointsEarned,
      p_order_id: order.id,
      p_description: `Puntos por venta física ${order.id}`,
      p_created_by: auth.user.id,
    });
  }

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    pointsEarned,
    totalCents,
    createdAt: order.created_at,
    paymentReference,
  });
}
