import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi } from "@/lib/auth";
import { CartApiError, loadUserCart, normalizeCartItems, saveUserCart } from "@/lib/cart-server";

const bodySchema = z.object({
  items: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().optional(), qty: z.number().int().min(1).max(999) })).max(25),
});

function isDev() {
  return process.env.NODE_ENV !== "production";
}

function logInfo(message: string, payload?: unknown) {
  if (isDev()) console.info(message, payload ?? {});
}

function mapCartErrorStatus(error: CartApiError) {
  if (error.code === "23503") return 404;
  if (error.code === "23514" || error.code === "22003") return 409;
  if (error.code === "42501") return 403;
  return 500;
}

function toErrorResponse(baseMessage: string, error: unknown) {
  const known = error instanceof CartApiError ? error : null;
  const status = known ? mapCartErrorStatus(known) : 500;

  return NextResponse.json(
    {
      error: baseMessage,
      ...(isDev()
        ? {
            message: error instanceof Error ? error.message : "Unknown error",
            step: known?.step ?? "unexpected",
            details: known?.details ?? null,
            hint: known?.hint ?? null,
            code: known?.code ?? null,
          }
        : null),
    },
    { status },
  );
}

export async function GET() {
  logInfo("[CART_API_DEBUG] GET /api/cart start");
  const auth = await requireUserApi();
  if ("error" in auth) {
    logInfo("[CART_AUTH_DEBUG] GET unauthorized");
    return auth.error;
  }

  logInfo("[CART_AUTH_DEBUG] GET authorized", { userId: auth.user.id });

  try {
    logInfo("[CART_DB_DEBUG] GET loadUserCart.start", { userId: auth.user.id });
    const result = await loadUserCart(auth.supabase, auth.user.id);
    logInfo("[CART_DB_DEBUG] GET loadUserCart.success", { userId: auth.user.id, itemCount: result.items.length });
    return NextResponse.json({ data: result.items, notices: result.notices });
  } catch (error) {
    console.error("[CART_API_DEBUG] GET failed", error);
    return toErrorResponse("Failed to load cart", error);
  }
}

export async function PUT(req: Request) {
  logInfo("[CART_API_DEBUG] PUT /api/cart start");
  const auth = await requireUserApi();
  if ("error" in auth) {
    logInfo("[CART_AUTH_DEBUG] PUT unauthorized");
    return auth.error;
  }

  logInfo("[CART_AUTH_DEBUG] PUT authorized", { userId: auth.user.id });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    logInfo("[CART_DB_DEBUG] PUT normalize.start", { userId: auth.user.id, inputCount: parsed.data.items.length });
    const normalized = await normalizeCartItems(auth.supabase, parsed.data.items);
    logInfo("[CART_DB_DEBUG] PUT normalize.success", { userId: auth.user.id, normalizedCount: normalized.items.length, noticeCount: normalized.notices.length });
    logInfo("[CART_DB_DEBUG] PUT saveUserCart.start", { userId: auth.user.id, saveCount: normalized.items.length });
    await saveUserCart(auth.supabase, auth.user.id, normalized.items);
    logInfo("[CART_DB_DEBUG] PUT saveUserCart.success", { userId: auth.user.id });
    return NextResponse.json({ data: normalized.items, notices: normalized.notices });
  } catch (error) {
    console.error("[CART_API_DEBUG] PUT failed", error);
    return toErrorResponse("Failed to save cart", error);
  }
}
