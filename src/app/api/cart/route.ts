import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi } from "@/lib/auth";
import { CartApiError, loadUserCart, normalizeCartItems, saveUserCart } from "@/lib/cart-server";

const bodySchema = z.object({
  items: z.array(z.object({ productId: z.string().uuid().optional(), variantId: z.string().uuid().optional(), qty: z.number().int().min(1).max(999) })).max(25),
});

export async function GET() {
  console.info("[CART_API_DEBUG] GET /api/cart start");
  const auth = await requireUserApi();
  if ("error" in auth) {
    console.warn("[CART_AUTH_DEBUG] GET unauthorized");
    return auth.error;
  }

  console.info("[CART_AUTH_DEBUG] GET authorized", { userId: auth.user.id });

  try {
    console.info("[CART_DB_DEBUG] GET loadUserCart.start", { userId: auth.user.id });
    const result = await loadUserCart(auth.supabase, auth.user.id);
    console.info("[CART_DB_DEBUG] GET loadUserCart.success", { userId: auth.user.id, itemCount: result.items.length });
    return NextResponse.json({ data: result.items, notices: result.notices });
  } catch (error) {
    console.error("[CART_API_DEBUG] GET failed", error);
    const isDev = process.env.NODE_ENV !== "production";
    const known = error instanceof CartApiError ? error : null;
    return NextResponse.json(
      {
        error: "Failed to load cart",
        ...(isDev
          ? {
              message: error instanceof Error ? error.message : "Unknown error",
              step: known?.step ?? "load_cart",
              details: known?.details ?? null,
              hint: known?.hint ?? null,
              code: known?.code ?? null,
            }
          : null),
      },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  console.info("[CART_API_DEBUG] PUT /api/cart start");
  const auth = await requireUserApi();
  if ("error" in auth) {
    console.warn("[CART_AUTH_DEBUG] PUT unauthorized");
    return auth.error;
  }

  console.info("[CART_AUTH_DEBUG] PUT authorized", { userId: auth.user.id });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    console.info("[CART_DB_DEBUG] PUT normalize.start", { userId: auth.user.id, inputCount: parsed.data.items.length });
    const normalized = await normalizeCartItems(auth.supabase, parsed.data.items);
    console.info("[CART_DB_DEBUG] PUT normalize.success", { userId: auth.user.id, normalizedCount: normalized.items.length });
    console.info("[CART_DB_DEBUG] PUT saveUserCart.start", { userId: auth.user.id, saveCount: normalized.items.length });
    await saveUserCart(auth.supabase, auth.user.id, normalized.items);
    console.info("[CART_DB_DEBUG] PUT saveUserCart.success", { userId: auth.user.id });
    return NextResponse.json({ data: normalized.items, notices: normalized.notices });
  } catch (error) {
    console.error("[CART_API_DEBUG] PUT failed", error);
    const isDev = process.env.NODE_ENV !== "production";
    const known = error instanceof CartApiError ? error : null;
    return NextResponse.json(
      {
        error: "Failed to save cart",
        ...(isDev
          ? {
              message: error instanceof Error ? error.message : "Unknown error",
              step: known?.step ?? "save_cart",
              details: known?.details ?? null,
              hint: known?.hint ?? null,
              code: known?.code ?? null,
            }
          : null),
      },
      { status: 500 },
    );
  }
}
