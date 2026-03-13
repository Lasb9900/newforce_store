import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi } from "@/lib/auth";
import { loadUserCart, normalizeCartItems, saveUserCart } from "@/lib/cart-server";

const bodySchema = z.object({
  items: z.array(z.object({ productId: z.string().uuid().optional(), variantId: z.string().uuid().optional(), qty: z.number().int().min(1).max(999) })).max(25),
});

export async function GET() {
  const auth = await requireUserApi();
  if ("error" in auth) return auth.error;

  try {
    const result = await loadUserCart(auth.supabase, auth.user.id);
    return NextResponse.json({ data: result.items, notices: result.notices });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load cart" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireUserApi();
  if ("error" in auth) return auth.error;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const normalized = await normalizeCartItems(auth.supabase, parsed.data.items);
    await saveUserCart(auth.supabase, auth.user.id, normalized.items);
    return NextResponse.json({ data: normalized.items, notices: normalized.notices });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save cart" }, { status: 500 });
  }
}
