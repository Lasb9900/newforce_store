import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { FilterDrawer } from "@/components/FilterDrawer";
import { PromoBanner } from "@/components/PromoBanner";
import { ShopFilters } from "@/components/ShopFilters";
import { SortSelect } from "@/components/SortSelect";
import { applyShopFilters, parseShopFilters, productCategory } from "@/lib/shop";
import { getServerSupabase } from "@/lib/supabase";
import { Product } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shop | Newforce Store",
  description: "Browse electronics and home products with smart filters and secure checkout.",
};

function activeFilterChips(filters: ReturnType<typeof parseShopFilters>) {
  const chips: Array<{ label: string; href: string }> = [];
  if (filters.q) chips.push({ label: `Search: ${filters.q}`, href: "/shop" });
  if (filters.category) chips.push({ label: `Category: ${filters.category}`, href: "/shop" });
  if (filters.minPrice || filters.maxPrice) {
    chips.push({
      label: `Price: ${filters.minPrice ? `$${filters.minPrice / 100}` : "$0"} - ${filters.maxPrice ? `$${filters.maxPrice / 100}` : "Any"}`,
      href: "/shop",
    });
  }
  if (filters.stock !== "all") chips.push({ label: filters.stock === "in" ? "In stock" : "Out of stock", href: "/shop" });
  if (filters.discounted) chips.push({ label: "On sale", href: "/shop" });
  if (filters.featured) chips.push({ label: "Featured", href: "/shop" });
  return chips;
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseShopFilters(params);
  const supabase = await getServerSupabase();

  const productsResult = await supabase
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("active", true)
    .order("created_at", { ascending: false });

  const products = ((productsResult.data ?? []) as Product[]).map((product) => ({
    ...product,
    name: product.name ?? "",
    images: product.images ?? [],
    variants: product.variants ?? [],
  }));

  const categories = Array.from(
    new Map(
      products.map((product) => {
        const slug = productCategory(product);
        return [slug, { slug, name: product.category?.name ?? product.department ?? "General" }];
      }),
    ).values(),
  );

  const filteredProducts = applyShopFilters(products, filters);
  const chips = activeFilterChips(filters);

  return (
    <div className="space-y-6">
      <PromoBanner />

      <header className="rounded-2xl border border-uiBorder bg-surface px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-brand-ink">Shop</h1>
            <p className="text-sm text-mutedText">Explore premium picks with trusted shipping, secure checkout and easy returns.</p>
          </div>
          <p className="rounded-full bg-brand-primary/10 px-3 py-1 text-sm font-medium text-brand-primary">{filteredProducts.length} products</p>
        </div>

        <form className="mt-4 space-y-3 rounded-xl bg-surfaceMuted p-3 md:flex md:items-center md:justify-between md:space-y-0 md:gap-3">
          <div className="flex-1">
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Search by product name, SKU, category or brand"
              className="w-full rounded-lg border border-uiBorder bg-white px-3 py-2.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
          <SortSelect currentSort={filters.sort} />
          <input type="hidden" name="category" value={filters.category} />
          <input type="hidden" name="minPrice" value={filters.minPrice ? filters.minPrice / 100 : ""} />
          <input type="hidden" name="maxPrice" value={filters.maxPrice ? filters.maxPrice / 100 : ""} />
          <input type="hidden" name="stock" value={filters.stock} />
          {filters.discounted ? <input type="hidden" name="discounted" value="true" /> : null}
          {filters.featured ? <input type="hidden" name="featured" value="true" /> : null}
          <button className="btn-primary text-sm">Search</button>
        </form>

        {chips.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span key={chip.label} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {chip.label}
                <Link href={chip.href} className="text-brand-primary">×</Link>
              </span>
            ))}
            <Link href="/shop" className="text-xs font-semibold text-brand-primary hover:underline">Clear all filters</Link>
          </div>
        ) : null}
      </header>

      <div className="md:hidden">
        <FilterDrawer>
          <form>
            <ShopFilters categories={categories} current={filters} />
          </form>
        </FilterDrawer>
      </div>

      <div className="grid gap-5 md:grid-cols-[280px_1fr]">
        <form className="hidden md:block">
          <ShopFilters categories={categories} current={filters} />
        </form>

        <section>
          {filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-uiBorder bg-surface p-10 text-center">
              <h2 className="text-xl font-semibold">No products matched this filter set</h2>
              <p className="mt-2 text-sm text-mutedText">Adjust search or filters to discover more curated products.</p>
              <Link href="/shop" className="btn-secondary mt-4">Reset catalog</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
