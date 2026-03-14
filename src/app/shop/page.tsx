import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { FilterDrawer } from "@/components/FilterDrawer";
import { PromoBanner } from "@/components/PromoBanner";
import { ShopFilters } from "@/components/ShopFilters";
import { SortSelect } from "@/components/SortSelect";
import { getProductsPublic, getVisibleCategories } from "@/lib/catalog";
import { CatalogCategory, getCategoryBySlug } from "@/lib/categories";
import { applyShopFilters, parseShopFilters } from "@/lib/shop";
import { Product } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shop | Newforce Store",
  description: "Browse electronics and home products with smart filters and secure checkout.",
};

function activeFilterChips(
  filters: ReturnType<typeof parseShopFilters>,
  categoryLabel: string | null,
) {
  const chips: Array<{ label: string; href: string }> = [];
  if (filters.q) chips.push({ label: `Search: ${filters.q}`, href: "/shop" });
  if (filters.category) chips.push({ label: `Category: ${categoryLabel ?? filters.category}`, href: "/shop" });
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
  const requestedFilters = parseShopFilters(params);

  let products: Product[] = [];
  let categories: CatalogCategory[] = [];
  let hasLoadError = false;

  try {
    products = await getProductsPublic();
    categories = await getVisibleCategories(products);
    console.info("[shop.page] products loaded", products.length);
    console.info("[shop.page] categories loaded", categories.length);
  } catch (error) {
    hasLoadError = true;
    console.error("[shop.page] failed to load catalog", error);
  }

  const validCategory = getCategoryBySlug(categories, requestedFilters.category);
  const filters = {
    ...requestedFilters,
    category: validCategory?.slug ?? "",
  };

  const filteredProducts = applyShopFilters(products, filters);
  const chips = activeFilterChips(filters, validCategory?.name ?? null);
  const categoryWarning = requestedFilters.category && !validCategory;

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

        {categoryWarning ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            The selected category is unavailable right now. Showing all products instead.
          </div>
        ) : null}

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

      {hasLoadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
          We couldn&apos;t load the catalog right now. Please refresh the page in a moment.
        </div>
      ) : null}

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
