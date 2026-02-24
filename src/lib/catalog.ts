import { getServerSupabase, getServiceSupabase } from "@/lib/supabase";

export async function getProductsPublic() {
  const sb = await getServerSupabase();
  const { data } = await sb
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("active", true)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getProductById(id: string) {
  const sb = await getServerSupabase();
  const { data } = await sb
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("id", id)
    .single();
  return data;
}

export async function getTopSelling(days = 30) {
  const admin = getServiceSupabase();
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const { data } = await admin
    .from("order_items")
    .select("product_id, qty, unit_price_cents_snapshot, products(name)")
    .gte("created_at", since as never);
  return data ?? [];
}
