import { requireOwnerPage } from "@/lib/auth";
import ProductsManager from "./products-manager";

export default async function AdminProducts() {
  const { supabase } = await requireOwnerPage();
  const { data } = await supabase
    .from("products")
    .select("id,name,sku,department,item_description,seller_category,item_condition,base_price_cents,base_stock,active,featured,has_variants,category_id,category:categories(name,slug)")
    .order("created_at", { ascending: false });

  const normalized = (data ?? []).map((row) => ({
    ...row,
    category: Array.isArray(row.category) ? row.category[0] ?? null : row.category,
  }));

  return <ProductsManager initialProducts={normalized} />;
}
