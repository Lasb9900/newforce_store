import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth";
import { productIdParamSchema } from "@/lib/schemas";

async function ensureWishlistId(auth: Awaited<ReturnType<typeof requireUserApi>>) {
  if ("error" in auth) return null;

  const { data: existing, error: findError } = await auth.supabase.from("wishlists").select("id").eq("user_id", auth.user.id).maybeSingle();
  if (findError) throw new Error(findError.message);
  if (existing?.id) return existing.id;

  const { data: inserted, error: insertError } = await auth.supabase.from("wishlists").insert({ user_id: auth.user.id }).select("id").single();
  if (insertError) throw new Error(insertError.message);
  return inserted.id;
}

export async function POST(_: Request, { params }: { params: Promise<{ productId: string }> }) {
  const auth = await requireUserApi();
  if ("error" in auth) return auth.error;

  const parsedParams = productIdParamSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: parsedParams.error.flatten() }, { status: 400 });
  }

  const { productId } = parsedParams.data;

  const { data: product, error: productError } = await auth.supabase.from("products").select("id,active").eq("id", productId).maybeSingle();
  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 });
  if (!product || !product.active) return NextResponse.json({ error: "Product unavailable" }, { status: 400 });

  try {
    const wishlistId = await ensureWishlistId(auth);
    if (!wishlistId) return NextResponse.json({ error: "Wishlist unavailable" }, { status: 500 });

    const { error } = await auth.supabase.from("wishlist_items").upsert({ wishlist_id: wishlistId, product_id: productId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wishlist update failed" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ productId: string }> }) {
  const auth = await requireUserApi();
  if ("error" in auth) return auth.error;

  const parsedParams = productIdParamSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: parsedParams.error.flatten() }, { status: 400 });
  }

  const { productId } = parsedParams.data;
  const { data: wishlist, error: wishlistError } = await auth.supabase.from("wishlists").select("id").eq("user_id", auth.user.id).maybeSingle();
  if (wishlistError) return NextResponse.json({ error: wishlistError.message }, { status: 500 });

  if (wishlist) {
    const { error } = await auth.supabase.from("wishlist_items").delete().eq("wishlist_id", wishlist.id).eq("product_id", productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
