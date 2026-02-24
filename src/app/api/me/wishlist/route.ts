import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth";

export async function GET() {
  const auth = await requireUserApi();
  if ("error" in auth) return auth.error;
  const { data: wishlist } = await auth.supabase.from("wishlists").select("id").eq("user_id", auth.user.id).single();
  if (!wishlist) return NextResponse.json({ data: [] });
  const { data } = await auth.supabase.from("wishlist_items").select("*, products(*)").eq("wishlist_id", wishlist.id);
  return NextResponse.json({ data: data ?? [] });
}
