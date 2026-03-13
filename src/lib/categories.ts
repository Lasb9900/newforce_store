import { Product } from "@/lib/types";

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  description?: string | null;
  featured?: boolean;
  productCount: number;
};

export function normalizeCategorySlug(value: string | null | undefined) {
  if (!value) return "";
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/[_\s]+/g, "-")
    .replaceAll(/[^a-z0-9-]/g, "")
    .replaceAll(/-+/g, "-");
}

export function formatCategoryName(value: string | null | undefined) {
  const fallback = "General";
  const source = value?.trim() || fallback;
  return source
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getProductCategoryMeta(product: Product) {
  const rawName = product.category?.name ?? product.department ?? product.seller_category ?? "General";
  const slug = normalizeCategorySlug(product.category?.slug ?? rawName);

  return {
    id: product.category?.id ?? slug,
    name: formatCategoryName(rawName),
    slug,
    imageUrl: null,
    description: null,
    featured: Boolean(product.featured),
  };
}

export function buildCatalogCategories(products: Product[]): CatalogCategory[] {
  const map = new Map<string, CatalogCategory>();

  for (const product of products) {
    const meta = getProductCategoryMeta(product);
    if (!meta.slug) continue;

    const existing = map.get(meta.slug);
    if (existing) {
      existing.productCount += 1;
      existing.featured = existing.featured || meta.featured;
      continue;
    }

    map.set(meta.slug, {
      ...meta,
      productCount: 1,
    });
  }

  return [...map.values()].sort((a, b) => {
    if (Number(b.featured) !== Number(a.featured)) return Number(b.featured) - Number(a.featured);
    if (b.productCount !== a.productCount) return b.productCount - a.productCount;
    return a.name.localeCompare(b.name);
  });
}

export function getCategoryBySlug(categories: CatalogCategory[], slug: string | null | undefined) {
  const normalized = normalizeCategorySlug(slug);
  if (!normalized) return null;
  return categories.find((category) => category.slug === normalized) ?? null;
}
