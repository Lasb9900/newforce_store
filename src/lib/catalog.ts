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

  const { data: productsData, error: productsError } = await sb
    .from("products")
    .select(`
      id,
      name,
      description,
      currency,
      base_price_cents,
      price_cents,
      base_stock,
      has_variants,
      active,
      featured,
      featured_rank,
      category_id,
      tags,
      sku,
      item_number,
      department,
      item_description,
      seller_category,
      condition,
      qty,
      image_url,
      redeemable,
      points_price,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: false });

  if (productsError) {
    console.error("[CATALOG_GET_PRODUCTS_ERROR_PRODUCTS]", productsError);
    return [];
  }

  const productIds = (productsData ?? []).map((p) => p.id).filter(Boolean);

  if (productIds.length === 0) {
    console.log("[CATALOG_GET_PRODUCTS_COUNT]", 0);
    console.log("[CATALOG_FIRST_PRODUCT_VARIANTS]", null);
    return [];
  }

  const { data: imagesData, error: imagesError } = await sb
    .from("product_images")
    .select("id,product_id,url,sort_order")
    .in("product_id", productIds)
    .order("sort_order", { ascending: true });

  if (imagesError) {
    console.error("[CATALOG_GET_PRODUCTS_ERROR_IMAGES]", imagesError);
  }

  const { data: variantsData, error: variantsError } = await sb
    .from("product_variants")
    .select("id,product_id,variant_name,price_cents,stock,active,sku")
    .in("product_id", productIds);

  if (variantsError) {
    console.error("[CATALOG_GET_PRODUCTS_ERROR_VARIANTS]", variantsError);
  }

  const imagesByProduct = new Map<string, unknown[]>();
  for (const image of imagesData ?? []) {
    const key = image.product_id;
    if (!key) continue;
    const list = imagesByProduct.get(key) ?? [];
    list.push(image);
    imagesByProduct.set(key, list);
  }

  const variantsByProduct = new Map<string, unknown[]>();
  for (const variant of variantsData ?? []) {
    const key = variant.product_id;
    if (!key) continue;
    const list = variantsByProduct.get(key) ?? [];
    list.push(variant);
    variantsByProduct.set(key, list);
  }

  const merged = (productsData ?? []).map((product) => ({
    ...product,
    images: imagesByProduct.get(product.id) ?? [],
    variants: variantsByProduct.get(product.id) ?? [],
  }));

  console.log("[CATALOG_GET_PRODUCTS_COUNT]", merged.length);
  console.log(
    "[CATALOG_FIRST_PRODUCT_VARIANTS]",
    merged[0]
      ? {
          id: merged[0].id,
          has_variants: merged[0].has_variants,
          variantsCount: Array.isArray(merged[0].variants) ? merged[0].variants.length : 0,
        }
      : null,
  );

  return (merged as unknown as Product[]).map(normalizeProduct);
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
