import { NextResponse } from "next/server";
import { createPosSaleSchema } from "@/lib/schemas";
import { requireSellerApi } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { processLoyaltyAccrual } from "@/lib/services/loyalty.service";

type RpcArrayShape = {
  success?: boolean;
  sale_id?: string;
  order_id?: string;
  created_at?: string;
  total_cents?: number;
  points_earned?: number;
  payment_reference?: string | null;
};

type NormalizedSaleResult = {
  saleId: string;
  orderId: string | null;
  createdAt: string | null;
  totalCents: number | null;
  pointsEarned: number;
  paymentReference: string | null;
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

function pickRpcObject(rawData: unknown): RpcArrayShape | null {
  if (Array.isArray(rawData)) {
    const first = rawData[0] as RpcArrayShape | undefined;
    if (!first || typeof first !== "object") return null;
    return first;
  }

  if (rawData && typeof rawData === "object") {
    return rawData as RpcArrayShape;
  }

  return null;
}

async function fetchPosSaleById(db: ReturnType<typeof getServiceSupabase>, saleId: string) {
  const { data } = await db
    .from("pos_sales")
    .select("id,created_at,total,payment_reference")
    .eq("id", saleId)
    .maybeSingle();

  return data
    ? {
        saleId: String(data.id),
        createdAt: String(data.created_at ?? ""),
        totalCents: Number(data.total ?? 0),
        paymentReference: (data.payment_reference as string | null) ?? null,
      }
    : null;
}

async function fetchPosSaleByOrderId(db: ReturnType<typeof getServiceSupabase>, orderId: string) {
  const { data, error } = await db
    .from("pos_sales")
    .select("id,created_at,total,payment_reference,order_id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error?.message?.includes("column pos_sales.order_id does not exist")) {
    return null;
  }

  return data
    ? {
        saleId: String(data.id),
        createdAt: String(data.created_at ?? ""),
        totalCents: Number(data.total ?? 0),
        paymentReference: (data.payment_reference as string | null) ?? null,
      }
    : null;
}

async function normalizeRpcResult(rawData: unknown, db: ReturnType<typeof getServiceSupabase>): Promise<NormalizedSaleResult | null> {
  const payload = pickRpcObject(rawData);
  if (!payload) return null;

  const rpcSaysSuccess = payload.success === undefined || payload.success === true;
  if (!rpcSaysSuccess) return null;

  const directSaleId = payload.sale_id ?? null;
  const directOrderId = payload.order_id ?? null;

  if (directSaleId) {
    const bySaleId = await fetchPosSaleById(db, directSaleId);
    if (bySaleId) {
      return {
        saleId: bySaleId.saleId,
        orderId: directOrderId,
        createdAt: payload.created_at ?? bySaleId.createdAt,
        totalCents: payload.total_cents ?? bySaleId.totalCents,
        pointsEarned: payload.points_earned ?? 0,
        paymentReference: payload.payment_reference ?? bySaleId.paymentReference,
      };
    }
  }

  if (directOrderId) {
    const byOrderId = await fetchPosSaleByOrderId(db, directOrderId);
    if (byOrderId) {
      return {
        saleId: byOrderId.saleId,
        orderId: directOrderId,
        createdAt: payload.created_at ?? byOrderId.createdAt,
        totalCents: payload.total_cents ?? byOrderId.totalCents,
        pointsEarned: payload.points_earned ?? 0,
        paymentReference: payload.payment_reference ?? byOrderId.paymentReference,
      };
    }
  }

  return null;
}

async function updatePosSaleLoyaltySnapshot(input: {
  saleId: string;
  userId: string | null;
  status: string;
  points: number;
  loyaltyError: string | null;
}) {
  const service = getServiceSupabase();

  const payload = {
    customer_user_id: input.userId,
    loyalty_status: input.status,
    loyalty_points_awarded: Math.max(0, Math.floor(input.points ?? 0)),
    loyalty_error: input.loyaltyError,
  };

  const { error } = await service.from("pos_sales").update(payload).eq("id", input.saleId);

  if (!error) return;

  const msg = error.message ?? "";
  if (msg.includes("column pos_sales.customer_user_id does not exist")) {
    await service
      .from("pos_sales")
      .update({ loyalty_status: input.status, loyalty_points_awarded: payload.loyalty_points_awarded, loyalty_error: input.loyaltyError })
      .eq("id", input.saleId);
    return;
  }

  if (msg.includes("column pos_sales.loyalty_status does not exist")) {
    return;
  }

  logError("Unable to persist POS loyalty snapshot", {
    saleId: input.saleId,
    userId: input.userId,
    status: input.status,
    loyaltyError: input.loyaltyError,
    error,
  });
}

export async function POST(req: Request) {
  const auth = await requireSellerApi();
  if ("error" in auth) {
    return auth.error;
  }

  const requestBody = await req.json();
  const parsed = createPosSaleSchema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten(), code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const paymentMethod = parsed.data.paymentMethod;
  const paymentReference = parsed.data.paymentReference?.trim() || null;

  if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
    return NextResponse.json({ error: "Método de pago inválido", code: "INVALID_PAYMENT_METHOD" }, { status: 400 });
  }

  if ((paymentMethod === "transfer" || paymentMethod === "card") && !paymentReference) {
    return NextResponse.json({ error: "La referencia de pago es obligatoria para tarjeta y transferencia", code: "PAYMENT_REFERENCE_REQUIRED" }, { status: 400 });
  }

  const item = parsed.data.items[0];
  if (!item?.productId) {
    return NextResponse.json({ error: "Producto no informado", code: "PRODUCT_ID_REQUIRED" }, { status: 400 });
  }
  if (!item?.qty || item.qty <= 0) {
    return NextResponse.json({ error: "Cantidad inválida", code: "INVALID_QTY" }, { status: 400 });
  }

  const customerEmail = parsed.data.customerEmail?.trim().toLowerCase() ?? null;
  let customerUserId: string | null = null;

  if (customerEmail) {
    try {
      const service = getServiceSupabase();
      const { data: profile } = await service.from("profiles").select("user_id").ilike("email", customerEmail).maybeSingle();
      customerUserId = profile?.user_id ?? null;
    } catch (error) {
      logError("Customer lookup failed", { customerEmail, error: error instanceof Error ? error.message : String(error) });
    }
  }

  logInfo("Calling transactional RPC create_pos_sale", {
    productId: item.productId,
    qty: item.qty,
    paymentMethod,
    customerEmail,
    customerUserId,
  });

  const { data: rawRpcData, error: rpcError } = await auth.supabase.rpc("create_pos_sale", {
    p_product_id: item.productId,
    p_qty: item.qty,
    p_payment_method: paymentMethod,
    p_payment_reference: paymentReference,
    p_customer_email: customerEmail,
    p_sold_by: auth.user.id,
    p_customer_id: customerUserId,
  });

  if (rpcError) {
    const code = rpcError.message || "INTERNAL_POS_SALE_ERROR";
    const status = BUSINESS_ERROR_CODES.has(code) ? 400 : 500;

    return NextResponse.json(
      {
        error: getClientMessage(code),
        code,
        details: rpcError.details,
        hint: rpcError.hint,
        sqlState: rpcError.code,
      },
      { status },
    );
  }

  let service: ReturnType<typeof getServiceSupabase>;
  try {
    service = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: "No se pudo inicializar servicio POS", code: "SERVICE_NOT_AVAILABLE" }, { status: 500 });
  }

  const normalized = await normalizeRpcResult(rawRpcData, service);
  if (!normalized) {
    return NextResponse.json(
      {
        error: "No se pudo identificar el ID real de la venta POS para procesar fidelidad",
        code: "UNSUPPORTED_RPC_RESPONSE",
      },
      { status: 500 },
    );
  }

  const resolvedTotalCents = normalized.totalCents ?? 0;

  let loyaltyStatus = "pending";
  let loyaltyPointsAwarded = 0;

  const { data: loyaltyData, error: loyaltyError } = await processLoyaltyAccrual({
    sourceType: "pos_sale",
    sourceId: normalized.saleId,
    userId: customerUserId,
    email: customerEmail,
    amountCents: resolvedTotalCents,
    metadata: {
      channel: "physical_store",
      sale_id: normalized.saleId,
      order_id: normalized.orderId,
      seller_id: auth.user.id,
      payment_method: paymentMethod,
    },
  });

  if (loyaltyError) {
    loyaltyStatus = "error";
    await updatePosSaleLoyaltySnapshot({
      saleId: normalized.saleId,
      userId: customerUserId,
      status: "error",
      points: 0,
      loyaltyError: loyaltyError.message,
    });
    logError("process_loyalty_accrual failed after POS sale commit", {
      saleId: normalized.saleId,
      loyaltyError,
    });
  } else {
    loyaltyStatus = loyaltyData?.status ?? "error";
    loyaltyPointsAwarded = Number(loyaltyData?.points_awarded ?? 0);

    await updatePosSaleLoyaltySnapshot({
      saleId: normalized.saleId,
      userId: loyaltyData?.resolved_user_id ?? customerUserId,
      status: loyaltyStatus,
      points: loyaltyPointsAwarded,
      loyaltyError: loyaltyStatus === "error" ? "Error loyalty no especificado" : null,
    });
  }

  return NextResponse.json(
    {
      success: true,
      saleId: normalized.saleId,
      orderId: normalized.orderId,
      productId: item.productId,
      pointsEarned: normalized.pointsEarned,
      totalCents: resolvedTotalCents,
      createdAt: normalized.createdAt,
      paymentReference: normalized.paymentReference,
      loyaltyStatus,
      loyaltyPointsAwarded,
    },
    { status: 201 },
  );
}
