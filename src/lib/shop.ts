import { Product } from "@/lib/types";

export const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "best_selling", label: "Best selling" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price low to high" },
  { value: "price_desc", label: "Price high to low" },
  { value: "rating_desc", label: "Highest rated" },
  { value: "discount_desc", label: "Biggest discount" },
] as const;

export type ShopFilters = {
  q: string;
  category: string;
  minPrice: number | null;
  maxPrice: number | null;
  stock: "all" | "in" | "out";
  discounted: boolean;
  featured: boolean;
  sort: string;
};

export function productPrice(product: Product) {
  return product.variants?.length ? Math.min(...product.variants.map((v) => v.price_cents)) : (product.base_price_cents ?? 0);
}

export function productCategory(product: Product) {
  return product.category?.slug ?? product.department?.toLowerCase().replaceAll(/\s+/g, "-") ?? "uncategorized";
}

export function parseShopFilters(params: Record<string, string | string[] | undefined>): ShopFilters {
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] ?? "" : (raw ?? "");
  };

  const minPriceRaw = Number(value("minPrice"));
  const maxPriceRaw = Number(value("maxPrice"));

  return {
    q: value("q"),
    category: value("category"),
    minPrice: Number.isFinite(minPriceRaw) && minPriceRaw > 0 ? Math.round(minPriceRaw * 100) : null,
    maxPrice: Number.isFinite(maxPriceRaw) && maxPriceRaw > 0 ? Math.round(maxPriceRaw * 100) : null,
    stock: value("stock") === "out" ? "out" : value("stock") === "in" ? "in" : "all",
    discounted: value("discounted") === "true",
    featured: value("featured") === "true",
    sort: value("sort") || "featured",
  };
}

export function applyShopFilters(products: Product[], filters: ShopFilters) {
  const q = filters.q.toLowerCase().trim();

  const filtered = products.filter((product) => {
    const price = productPrice(product);
    const category = productCategory(product);
    const stock = product.base_stock ?? product.qty ?? 0;
    const comparePrice = product.price_cents ?? 0;
    const searchable = [product.name, product.sku ?? "", product.department ?? "", product.seller_category ?? "", product.item_number ?? ""]
      .join(" ")
      .toLowerCase();

    if (q && !searchable.includes(q)) return false;
    if (filters.category && category !== filters.category) return false;
    if (filters.minPrice && price < filters.minPrice) return false;
    if (filters.maxPrice && price > filters.maxPrice) return false;
    if (filters.stock === "in" && stock <= 0) return false;
    if (filters.stock === "out" && stock > 0) return false;
    if (filters.discounted && comparePrice <= price) return false;
    if (filters.featured && !product.featured) return false;

    return true;
  });

  return filtered.sort((a, b) => {
    const aPrice = productPrice(a);
    const bPrice = productPrice(b);
    const aDiscount = Math.max((a.price_cents ?? 0) - aPrice, 0);
    const bDiscount = Math.max((b.price_cents ?? 0) - bPrice, 0);

    switch (filters.sort) {
      case "price_asc":
        return aPrice - bPrice;
      case "price_desc":
        return bPrice - aPrice;
      case "discount_desc":
        return bDiscount - aDiscount;
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "best_selling":
        return Number(b.featured) - Number(a.featured);
      case "rating_desc":
        return Number(b.featured) - Number(a.featured);
      case "featured":
      default:
        return Number(b.featured) - Number(a.featured) || a.featured_rank - b.featured_rank;
    }
  });
}
