import { NextResponse } from "next/server";
import { createPosSaleSchema } from "@/lib/schemas";
import { requireSellerApi } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

const VALID_PAYMENT_METHODS = new Set(["cash", "card", "transfer"]);

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

  if ((paymentMethod === "transfer" || paymentMethod === "card") && !paymentReference) {
    return NextResponse.json({ error: "La referencia de pago es obligatoria para tarjeta y transferencia" }, { status: 400 });
  }

  const item = parsed.data.items[0];
  if (!item?.productId) return NextResponse.json({ error: "Producto no informado" }, { status: 400 });
  if (!item?.qty || item.qty <= 0) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });

  let service: ReturnType<typeof getServiceSupabase> | null = null;
  try {
    service = getServiceSupabase();
  } catch {
    service = null;
  }

  let customerId: string | null = null;
  let customerEmail: string | null = parsed.data.customerEmail ?? null;

  if (parsed.data.customerEmail && service) {
    const { data: profile } = await service
      .from("profiles")
      .select("user_id,email")
      .ilike("email", parsed.data.customerEmail)
      .maybeSingle();

    customerId = profile?.user_id ?? null;
    customerEmail = profile?.email ?? parsed.data.customerEmail;
  }

  const { data, error } = await auth.supabase.rpc("create_pos_sale", {
    p_product_id: item.productId,
    p_qty: item.qty,
    p_payment_method: paymentMethod,
    p_payment_reference: paymentReference,
    p_customer_email: customerEmail,
    p_sold_by: auth.user.id,
    p_customer_id: customerId,
  });

  if (error || !data?.[0]) {
    const msg = error?.message || "No se pudo registrar la venta";
    if (msg.includes("Could not find the function public.create_pos_sale")) {
      return NextResponse.json(
        {
          error:
            "La función RPC create_pos_sale no está sincronizada en Supabase. Ejecuta las migraciones POS más recientes y recarga schema cache (notify pgrst, 'reload schema').",
          details: msg,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (customerId && data[0].points_earned > 0 && service) {
    await service.rpc("add_points", {
      p_user_id: customerId,
      p_points: data[0].points_earned,
      p_order_id: data[0].order_id,
      p_description: `Puntos por venta física ${data[0].order_id}`,
      p_created_by: auth.user.id,
    });
  }

  return NextResponse.json({
    ok: true,
    orderId: data[0].order_id,
    pointsEarned: data[0].points_earned,
    totalCents: data[0].total_cents,
    createdAt: data[0].created_at,
    paymentReference: data[0].payment_reference,
  });
}
