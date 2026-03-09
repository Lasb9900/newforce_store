import { requireOwnerPage } from "@/lib/auth";
import ProductsManager from "./products-manager";

export default async function AdminProducts() {
  const { supabase } = await requireOwnerPage();
  const { data } = await supabase
    .from("products")
    .select("id,name,sku,department,item_description,seller_category,item_condition,base_price_cents,base_stock,active,featured,has_variants,category_id,category:categories(name,slug),images:product_images(id,url,sort_order)")
    .order("created_at", { ascending: false });

  const normalized = (data ?? []).map((row) => {
    const category = Array.isArray(row.category) ? row.category[0] ?? null : row.category;
    const images = Array.isArray(row.images) ? [...row.images] : [];
    const primary = images.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];

    return {
      ...row,
      category,
      image_url: primary?.url ?? null,
    };
  });

  return <ProductsManager initialProducts={normalized} />;
}
