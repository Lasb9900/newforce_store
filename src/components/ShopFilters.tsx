import Link from "next/link";
import { formatCategoryName } from "@/lib/categories";

type ShopFiltersProps = {
  categories: Array<{ slug: string; name: string; productCount: number }>;
  current: {
    category: string;
    minPrice: number | null;
    maxPrice: number | null;
    stock: "all" | "in" | "out";
    discounted: boolean;
    featured: boolean;
    q: string;
    sort: string;
  };
  className?: string;
};

export function ShopFilters({ categories, current, className }: ShopFiltersProps) {
  return (
    <aside className={className}>
      <div className="rounded-2xl border border-uiBorder bg-surface p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Filters</h2>
          <Link href="/shop" className="text-xs font-medium text-brand-primary hover:underline">Clear all</Link>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <label className="mb-1 block font-medium">Category</label>
            <select name="category" defaultValue={current.category} className="w-full rounded-lg border border-uiBorder bg-white px-3 py-2">
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>{formatCategoryName(category.name)} ({category.productCount})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block font-medium">Min $</label>
              <input name="minPrice" type="number" min={0} defaultValue={current.minPrice ? current.minPrice / 100 : ""} className="w-full rounded-lg border border-uiBorder bg-white px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block font-medium">Max $</label>
              <input name="maxPrice" type="number" min={0} defaultValue={current.maxPrice ? current.maxPrice / 100 : ""} className="w-full rounded-lg border border-uiBorder bg-white px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium">Availability</label>
            <select name="stock" defaultValue={current.stock} className="w-full rounded-lg border border-uiBorder bg-white px-3 py-2">
              <option value="all">All</option>
              <option value="in">In stock</option>
              <option value="out">Out of stock</option>
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" name="discounted" value="true" defaultChecked={current.discounted} className="size-4 rounded border-uiBorder" />
            <span>On sale</span>
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" name="featured" value="true" defaultChecked={current.featured} className="size-4 rounded border-uiBorder" />
            <span>Featured only</span>
          </label>
        </div>

        <input type="hidden" name="q" value={current.q} />
        <input type="hidden" name="sort" value={current.sort} />
        <button className="btn-primary mt-4 w-full">Apply filters</button>
      </div>
    </aside>
  );
}
