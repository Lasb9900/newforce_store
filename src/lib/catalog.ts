import { CatalogCategory, buildCatalogCategories, getCategoryBySlug, normalizeCategorySlug } from "@/lib/categories";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase";
import { Product } from "@/lib/types";

type CategoryRow = {
  id: string;
  name: string;
  slug: string | null;
  description?: string | null;
  image_url?: string | null;
  is_featured?: boolean | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    name: product.name ?? "",
    images: product.images ?? [],
    variants: product.variants ?? [],
  };
}

function normalizeCategoryRow(row: CategoryRow): CatalogCategory {
  return {
    id: row.id,
    name: row.name,
    slug: normalizeCategorySlug(row.slug ?? row.name),
    imageUrl: row.image_url ?? null,
    description: row.description ?? null,
    featured: Boolean(row.is_featured),
    productCount: 0,
  };
}

function mergeCategoriesWithProducts(categories: CatalogCategory[], products: Product[]) {
  const productDerived = buildCatalogCategories(products);
  const bySlug = new Map<string, CatalogCategory>();

  for (const category of categories) {
    if (!category.slug) continue;
    bySlug.set(category.slug, { ...category });
  }

  for (const category of productDerived) {
    const existing = bySlug.get(category.slug);
    if (existing) {
      existing.productCount = category.productCount;
      existing.featured = existing.featured || category.featured;
      if (!existing.name) existing.name = category.name;
      continue;
    }

    bySlug.set(category.slug, category);
  }

  return [...bySlug.values()].sort((a, b) => {
    if (Number(b.featured) !== Number(a.featured)) return Number(b.featured) - Number(a.featured);
    if ((b.productCount ?? 0) !== (a.productCount ?? 0)) return (b.productCount ?? 0) - (a.productCount ?? 0);
    return a.name.localeCompare(b.name);
  });
}

export async function getProducts() {
  const sb = await getServerSupabase();
  const { data } = await sb
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("active", true)
    .order("created_at", { ascending: false });

  return ((data ?? []) as Product[]).map(normalizeProduct);
}

export async function getCategories(products?: Product[]) {
  const sourceProducts = products ?? (await getProducts());
  const sb = await getServerSupabase();

  const { data: categoryRows, error } = await sb
    .from("categories")
    .select("id,name,slug,description,image_url,is_featured,sort_order,is_active")
    .or("is_active.is.null,is_active.eq.true");

  if (error) {
    return buildCatalogCategories(sourceProducts);
  }

  const normalized = ((categoryRows ?? []) as CategoryRow[]).map(normalizeCategoryRow);
  return mergeCategoriesWithProducts(normalized, sourceProducts);
}

export async function getVisibleCategories(products?: Product[]) {
  const sourceProducts = products ?? (await getProducts());
  const categories = await getCategories(sourceProducts);
  return categories.filter((category) => category.productCount > 0);
}

export async function getFeaturedCategories(products?: Product[], limit = 4) {
  const visible = await getVisibleCategories(products);
  const featured = visible.filter((category) => category.featured);
  const sortedFeatured = [...featured].sort((a, b) => b.productCount - a.productCount);

  if (sortedFeatured.length >= limit) {
    return sortedFeatured.slice(0, limit);
  }

  const supplemental = visible.filter((category) => !sortedFeatured.some((item) => item.slug === category.slug));
  return [...sortedFeatured, ...supplemental].slice(0, limit);
}

export async function getProductsByCategorySlug(categorySlug: string) {
  const products = await getProducts();
  const categories = await getVisibleCategories(products);
  const category = getCategoryBySlug(categories, categorySlug);

  if (!category) {
    return { products, category: null };
  }

  return {
    category,
    products: products.filter((product) => normalizeCategorySlug(product.category?.slug ?? product.department ?? product.seller_category) === category.slug),
  };
}

export async function getProductsPublic() {
  return getProducts();
}

export async function getProductById(id: string) {
  const sb = await getServerSupabase();
  const { data } = await sb
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("id", id)
    .single();
  return data;
}

export async function getTopSelling(days = 30) {
  const admin = getServiceSupabase();
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const { data } = await admin
    .from("order_items")
    .select("product_id, qty, unit_price_cents_snapshot, products(name)")
    .gte("created_at", since as never);
  return data ?? [];
}
