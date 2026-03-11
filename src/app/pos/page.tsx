import { redirect } from "next/navigation";
import { requireCustomerPage } from "@/lib/auth";
import PosForm from "./PosForm";

export default async function PosPage() {
  const { supabase, profile } = await requireCustomerPage("/login?next=/pos");
  if (!profile || !["seller", "admin", "owner"].includes(profile.role)) {
    redirect("/account");
  }

  const { data: products } = await supabase
    .from("products")
    .select("id,name,item_number,sku,category,image_url,active,price_cents,base_price_cents,qty,base_stock")
    .eq("active", true)
    .or("qty.gt.0,base_stock.gt.0")
    .order("name");

  const normalizedProducts = (products ?? []).map((p) => {
    const stockCandidates = [p.qty, p.base_stock].filter((v): v is number => typeof v === "number");
    const operationalStock = stockCandidates.length ? Math.min(...stockCandidates) : 0;

    return {
      ...p,
      price_cents:
        (typeof p.price_cents === "number" && p.price_cents > 0
          ? p.price_cents
          : typeof p.base_price_cents === "number" && p.base_price_cents > 0
            ? p.base_price_cents
            : p.price_cents ?? p.base_price_cents ?? null),
      qty: operationalStock,
    };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Punto de venta</h1>
      <PosForm products={normalizedProducts} />
    </div>
  );
}
