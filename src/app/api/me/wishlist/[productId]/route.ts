import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function POST(_: Request, { params }: { params: Promise<{ productId: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { productId } = await params;
  let { data: wishlist } = await auth.supabase.from("wishlists").select("id").eq("user_id", auth.user.id).single();
  if (!wishlist) {
    const res = await auth.supabase.from("wishlists").insert({ user_id: auth.user.id }).select("id").single();
    wishlist = res.data;
  }
  const { error } = await auth.supabase.from("wishlist_items").upsert({ wishlist_id: wishlist!.id, product_id: productId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ productId: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { productId } = await params;
  const { data: wishlist } = await auth.supabase.from("wishlists").select("id").eq("user_id", auth.user.id).single();
  if (wishlist) await auth.supabase.from("wishlist_items").delete().eq("wishlist_id", wishlist.id).eq("product_id", productId);
  return NextResponse.json({ ok: true });
}
