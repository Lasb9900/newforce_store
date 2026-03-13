import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi } from "@/lib/auth";
import { loadUserCart, normalizeCartItems, saveUserCart } from "@/lib/cart-server";

const bodySchema = z.object({
  guestItems: z.array(z.object({ productId: z.string().uuid().optional(), variantId: z.string().uuid().optional(), qty: z.number().int().min(1).max(999) })).max(25),
});

export async function POST(req: Request) {
  const auth = await requireUserApi();
  if ("error" in auth) return auth.error;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const current = await loadUserCart(auth.supabase, auth.user.id);
    const merged = await normalizeCartItems(auth.supabase, [...current.items, ...parsed.data.guestItems]);
    await saveUserCart(auth.supabase, auth.user.id, merged.items);

    const notices = [...merged.notices];
    if (parsed.data.guestItems.length > 0) {
      notices.unshift({ type: "info", message: "Your guest cart was merged into your account cart." });
    }

    return NextResponse.json({ data: merged.items, notices });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to merge cart" }, { status: 500 });
  }
}
