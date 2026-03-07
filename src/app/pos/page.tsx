import { redirect } from "next/navigation";
import { requireCustomerPage } from "@/lib/auth";
import PosForm from "./pos-form";

export default async function PosPage() {
  const { supabase, profile } = await requireCustomerPage("/login?next=/pos");
  if (!profile || !["seller", "admin", "owner"].includes(profile.role)) {
    redirect("/account");
  }

  const { data: products } = await supabase.from("products").select("id,name,base_price_cents,base_stock").eq("active", true).gt("base_stock", 0).order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Punto de venta</h1>
      <PosForm products={products ?? []} />
    </div>
  );
}
