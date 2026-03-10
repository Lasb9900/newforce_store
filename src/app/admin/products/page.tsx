import { requireOwnerPage } from "@/lib/auth";
import ProductsManager from "./products-manager";

export default async function AdminProducts() {
  const { supabase } = await requireOwnerPage();
  const { data } = await supabase
    .from("products")
    .select("id,name,sku,item_number,department,item_description,seller_category,category,condition,item_condition,qty,base_price_cents,price_cents,base_stock,image_url,active,featured,has_variants,category_id,category_ref:categories(name,slug),images:product_images(id,url,sort_order)")
    .order("created_at", { ascending: false });

  const normalized = (data ?? []).map((row) => {
    const categoryRef = Array.isArray(row.category_ref) ? row.category_ref[0] ?? null : row.category_ref;
    const images = Array.isArray(row.images) ? [...row.images] : [];
    const primary = images.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];

    return {
      ...row,
      category_ref: categoryRef,
      image_url: row.image_url ?? primary?.url ?? null,
    };
  });

  return <ProductsManager initialProducts={normalized} />;
}
