import { ProductCard } from "@/components/ProductCard";
import { getServerSupabase } from "@/lib/supabase";
import { Product } from "@/lib/types";

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const q = (params.q ?? "").toLowerCase();
  const supabase = await getServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role = "anonymous";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
    role = profile?.role ?? "authenticated";
  }

  const productsResult = await supabase
    .from("products")
    .select("*, images:product_images(*), variants:product_variants(*)")
    .eq("active", true)
    .order("created_at", { ascending: false });

  const productsRaw = (productsResult.data ?? []) as Product[];
  const imageRelationCount = productsRaw.reduce((sum, p) => sum + (p.images?.length ?? 0), 0);
  const variantRelationCount = productsRaw.reduce((sum, p) => sum + (p.variants?.length ?? 0), 0);

  const dropped: Array<{ id: string; reason: string }> = [];
  const mappedProducts = productsRaw
    .map((p) => ({
      ...p,
      name: p.name ?? "",
      images: p.images ?? [],
      variants: p.variants ?? [],
    }))
    .filter((p) => {
      if (!p.name.trim()) {
        dropped.push({ id: p.id, reason: "missing_name" });
        return false;
      }
      return p.name.toLowerCase().includes(q);
    });

  console.log("[SHOP] session role:", role);
  console.log("[SHOP] products raw count:", productsRaw.length);
  console.log("[SHOP] products raw sample:", productsRaw.slice(0, 3));
  console.log("[SHOP] mapped products count:", mappedProducts.length);
  console.log("[SHOP] mapped products sample:", mappedProducts.slice(0, 3));
  console.log("[SHOP] image relation count:", imageRelationCount);
  console.log("[SHOP] variant relation count:", variantRelationCount);
  console.log("[SHOP] render errors or dropped products:", {
    queryError: productsResult.error?.message ?? null,
    dropped,
  });

  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-uiBorder bg-surface px-5 py-4">
        <h1 className="text-2xl font-bold text-brand-ink">Shop</h1>
        <p className="text-sm text-mutedText">Encuentra electrodomésticos y tecnología por categoría.</p>
        <form className="mt-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar producto..."
            className="w-full rounded-md border border-uiBorder bg-surface p-2.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
          />
        </form>
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{mappedProducts.map((p) => <ProductCard key={p.id} product={p} />)}</div>
    </div>
  );
}
