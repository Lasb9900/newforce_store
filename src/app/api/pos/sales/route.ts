import { NextResponse } from "next/server";
import { createPosSaleSchema } from "@/lib/schemas";
import { requireSellerApi } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

const VALID_PAYMENT_METHODS = new Set(["cash", "card", "transfer"]);

function logInfo(step: string, payload?: Record<string, unknown>) {
  console.info(`[POS_SALE] ${step}`, payload ?? {});
}

function logError(step: string, payload?: Record<string, unknown>) {
  console.error(`[POS_SALE][ERROR] ${step}`, payload ?? {});
}

export async function POST(req: Request) {
  logInfo("Starting sale creation");

  const auth = await requireSellerApi();
  if ("error" in auth) {
    logError("Unauthorized seller attempt");
    return auth.error;
  }

  const requestBody = await req.json();
  const parsed = createPosSaleSchema.safeParse(requestBody);
  if (!parsed.success) {
    logError("Invalid payload", { issues: parsed.error.issues });
    return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const paymentMethod = parsed.data.paymentMethod;
  const paymentReference = parsed.data.paymentReference?.trim() || null;

  if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
    logError("Invalid payment method", { paymentMethod });
    return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });
  }

  if ((paymentMethod === "transfer" || paymentMethod === "card") && !paymentReference) {
    logError("Missing required payment reference", { paymentMethod });
    return NextResponse.json({ error: "La referencia de pago es obligatoria para tarjeta y transferencia" }, { status: 400 });
  }

  const item = parsed.data.items[0];
  if (!item?.productId) {
    logError("Missing product id in sale item");
    return NextResponse.json({ error: "Producto no informado" }, { status: 400 });
  }
  if (!item?.qty || item.qty <= 0) {
    logError("Invalid quantity", { qty: item?.qty });
    return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  }

  logInfo("Payload normalized", {
    sellerId: auth.user.id,
    productId: item.productId,
    qty: item.qty,
    paymentMethod,
    hasPaymentReference: Boolean(paymentReference),
    hasCustomerEmail: Boolean(parsed.data.customerEmail),
  });

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

    if (profileError) {
      logError("Failed customer profile lookup", { profileError });
    }

    customerId = profile?.user_id ?? null;
    customerEmail = profile?.email ?? parsed.data.customerEmail;
  }

  logInfo("Calling transactional RPC create_pos_sale", {
    productId: item.productId,
    qty: item.qty,
    paymentMethod,
    customerId,
  });

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
    logError("RPC create_pos_sale failed", {
      message: msg,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

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

    const status = error?.code?.startsWith("22") || error?.code?.startsWith("23") || error?.code === "P0001" ? 400 : 500;
    return NextResponse.json(
      { error: msg, details: error?.details, hint: error?.hint, code: error?.code },
      { status },
    );
  }

  logInfo("Sale committed in DB transaction", {
    orderId: data[0].order_id,
    totalCents: data[0].total_cents,
    pointsEarned: data[0].points_earned,
  });

  if (customerId && data[0].points_earned > 0 && service) {
    const { error: pointsError } = await service.rpc("add_points", {
      p_user_id: customerId,
      p_points: data[0].points_earned,
      p_order_id: data[0].order_id,
      p_description: `Puntos por venta física ${data[0].order_id}`,
      p_created_by: auth.user.id,
    });

    if (pointsError) {
      logError("add_points RPC failed after sale commit", {
        orderId: data[0].order_id,
        customerId,
        pointsError,
      });
    }
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
