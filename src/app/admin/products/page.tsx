import { requireOwnerPage } from "@/lib/auth";
import ProductsManager from "./products-manager";

export default async function AdminProducts() {
  const { supabase } = await requireOwnerPage();
  const { data } = await supabase
    .from("products")
    .select("id,name,sku,base_price_cents,base_stock,active,featured,has_variants,category_id")
    .order("created_at", { ascending: false });

  return <ProductsManager initialProducts={data ?? []} />;
}
