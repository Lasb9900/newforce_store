import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth";

export async function GET() {
  const auth = await requireUserApi();
  if ("error" in auth) return auth.error;

  const { data: wishlist, error: wishlistError } = await auth.supabase.from("wishlists").select("id").eq("user_id", auth.user.id).maybeSingle();
  if (wishlistError) return NextResponse.json({ error: wishlistError.message }, { status: 500 });
  if (!wishlist) return NextResponse.json({ data: [] });

  const { data, error } = await auth.supabase
    .from("wishlist_items")
    .select("id,product_id,created_at,products(id,name,image_url,base_price_cents,active)")
    .eq("wishlist_id", wishlist.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filtered = (data ?? []).filter((item) => {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    return product?.active !== false;
  });
  return NextResponse.json({ data: filtered });
}
