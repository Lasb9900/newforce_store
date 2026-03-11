import { NextResponse } from "next/server";
import { createPosSaleSchema } from "@/lib/schemas";
import { requireSellerApi } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

type RpcArrayShape = {
  order_id: string;
  created_at: string;
  total_cents: number;
  points_earned: number;
  payment_reference: string | null;
};

type RpcObjectShape = {
  success?: boolean;
  sale_id?: string;
  order_id?: string;
  created_at?: string;
  total_cents?: number;
  points_earned?: number;
  payment_reference?: string | null;
};

const VALID_PAYMENT_METHODS = new Set(["cash", "card", "transfer"]);
const BUSINESS_ERROR_CODES = new Set([
  "INVALID_QTY",
  "INVALID_PAYMENT_METHOD",
  "PAYMENT_REFERENCE_REQUIRED",
  "PRODUCT_NOT_FOUND",
  "PRODUCT_INACTIVE",
  "INVALID_PRICE",
  "STOCK_INSUFFICIENT",
  "SALE_INSERT_FAILED",
  "SALE_ITEM_INSERT_FAILED",
  "INVENTORY_UPDATE_FAILED",
]);

function logInfo(step: string, payload?: Record<string, unknown>) {
  console.info(`[POS_SALE] ${step}`, payload ?? {});
}

function logError(step: string, payload?: Record<string, unknown>) {
  console.error(`[POS_SALE][ERROR] ${step}`, payload ?? {});
}

function getClientMessage(codeOrMessage: string) {
  switch (codeOrMessage) {
    case "INVALID_QTY":
      return "Cantidad inválida";
    case "INVALID_PAYMENT_METHOD":
      return "Método de pago inválido";
    case "PAYMENT_REFERENCE_REQUIRED":
      return "La referencia de pago es obligatoria para tarjeta y transferencia";
    case "PRODUCT_NOT_FOUND":
      return "Producto no encontrado";
    case "PRODUCT_INACTIVE":
      return "Producto inactivo";
    case "INVALID_PRICE":
      return "El producto tiene un precio inválido";
    case "STOCK_INSUFFICIENT":
      return "Stock insuficiente";
    case "INVENTORY_UPDATE_FAILED":
      return "No se pudo actualizar inventario de forma segura";
    default:
      return "No se pudo registrar la venta";
  }
}

async function normalizeRpcResult(
  rawData: unknown,
  supabase: unknown,
) {
  const db = supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{
            data: { id: string; created_at: string; total_cents: number; points_earned: number | null; payment_reference: string | null } | null;
          }>;
        };
      };
    };
  };
  const payload = rawData as RpcArrayShape[] | RpcObjectShape | null;

  if (Array.isArray(payload) && payload[0]?.order_id) {
    return {
      orderId: payload[0].order_id,
      createdAt: payload[0].created_at,
      totalCents: payload[0].total_cents,
      pointsEarned: payload[0].points_earned,
      paymentReference: payload[0].payment_reference ?? null,
    };
  }

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const maybeOrderId = payload.order_id ?? payload.sale_id;

    if (!maybeOrderId) return null;

    if (payload.total_cents != null && payload.created_at) {
      return {
        orderId: maybeOrderId,
        createdAt: payload.created_at,
        totalCents: payload.total_cents,
        pointsEarned: payload.points_earned ?? 0,
        paymentReference: payload.payment_reference ?? null,
      };
    }

    const { data: orderRow } = await db
      .from("orders")
      .select("id,created_at,total_cents,points_earned,payment_reference")
      .eq("id", maybeOrderId)
      .maybeSingle();

    if (orderRow) {
      return {
        orderId: orderRow.id,
        createdAt: orderRow.created_at,
        totalCents: orderRow.total_cents,
        pointsEarned: orderRow.points_earned ?? 0,
        paymentReference: orderRow.payment_reference ?? null,
      };
    }
  }

  return null;
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
    return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten(), code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const paymentMethod = parsed.data.paymentMethod;
  const paymentReference = parsed.data.paymentReference?.trim() || null;

  if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
    logError("Invalid payment method", { paymentMethod });
    return NextResponse.json({ error: "Método de pago inválido", code: "INVALID_PAYMENT_METHOD" }, { status: 400 });
  }

  if ((paymentMethod === "transfer" || paymentMethod === "card") && !paymentReference) {
    logError("Missing required payment reference", { paymentMethod });
    return NextResponse.json({ error: "La referencia de pago es obligatoria para tarjeta y transferencia", code: "PAYMENT_REFERENCE_REQUIRED" }, { status: 400 });
  }

  const item = parsed.data.items[0];
  if (!item?.productId) {
    logError("Missing product id in sale item");
    return NextResponse.json({ error: "Producto no informado", code: "PRODUCT_ID_REQUIRED" }, { status: 400 });
  }
  if (!item?.qty || item.qty <= 0) {
    logError("Invalid quantity", { qty: item?.qty });
    return NextResponse.json({ error: "Cantidad inválida", code: "INVALID_QTY" }, { status: 400 });
  }

  logInfo("Payload normalized", {
    sellerId: auth.user.id,
    productId: item.productId,
    qty: item.qty,
    paymentMethod,
    hasPaymentReference: Boolean(paymentReference),
    hasCustomerEmail: Boolean(parsed.data.customerEmail),
  });

  const { data: currentProduct, error: productReadError } = await auth.supabase
    .from("products")
    .select("id,qty,base_stock,active")
    .eq("id", item.productId)
    .maybeSingle();

  if (productReadError) {
    logError("Failed to read current product stock before RPC", { productReadError, productId: item.productId });
  } else {
    logInfo("Current DB stock snapshot", {
      productId: item.productId,
      qty: currentProduct?.qty,
      baseStock: currentProduct?.base_stock,
      operationalStock:
        currentProduct
          ? Math.min(
              currentProduct.qty ?? Number.POSITIVE_INFINITY,
              currentProduct.base_stock ?? Number.POSITIVE_INFINITY,
            )
          : null,
      active: currentProduct?.active,
    });
  }

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

  if (error) {
    const code = error.message || "INTERNAL_POS_SALE_ERROR";
    const status = BUSINESS_ERROR_CODES.has(code) ? 400 : 500;

    logError("RPC create_pos_sale failed", {
      businessCode: code,
      details: error.details,
      hint: error.hint,
      sqlState: error.code,
      rpcResponseData: data,
    });

    if ((error.message || "").includes("Could not find the function public.create_pos_sale")) {
      return NextResponse.json(
        {
          error:
            "La función RPC create_pos_sale no está sincronizada en Supabase. Ejecuta las migraciones POS más recientes y recarga schema cache (notify pgrst, 'reload schema').",
          code: "RPC_NOT_FOUND",
          details: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error: getClientMessage(code),
        code,
        details: error.details,
        hint: error.hint,
        sqlState: error.code,
      },
      { status },
    );
  }

  logInfo("Raw RPC success payload", {
    isArray: Array.isArray(data),
    payloadKeys: data && typeof data === "object" ? Object.keys(data as Record<string, unknown>) : [],
    data,
  });

  const normalized = await normalizeRpcResult(data, auth.supabase);
  if (!normalized) {
    logError("RPC returned no error but unsupported payload shape", { data });
    return NextResponse.json(
      {
        error: "No se pudo registrar la venta: respuesta no reconocida del motor transaccional",
        code: "UNSUPPORTED_RPC_RESPONSE",
      },
      { status: 500 },
    );
  }

  logInfo("Sale committed in DB transaction", {
    orderId: normalized.orderId,
    totalCents: normalized.totalCents,
    pointsEarned: normalized.pointsEarned,
  });

  if (customerId && normalized.pointsEarned > 0 && service) {
    const { error: pointsError } = await service.rpc("add_points", {
      p_user_id: customerId,
      p_points: normalized.pointsEarned,
      p_order_id: normalized.orderId,
      p_description: `Puntos por venta física ${normalized.orderId}`,
      p_created_by: auth.user.id,
    });

    if (pointsError) {
      logError("add_points RPC failed after sale commit", {
        orderId: normalized.orderId,
        customerId,
        pointsError,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    orderId: normalized.orderId,
    pointsEarned: normalized.pointsEarned,
    totalCents: normalized.totalCents,
    createdAt: normalized.createdAt,
    paymentReference: normalized.paymentReference,
  });
}
