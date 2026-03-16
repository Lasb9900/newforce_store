import { CatalogCategory, buildCatalogCategories, getCategoryBySlug, normalizeCategorySlug } from "@/lib/categories";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase";
import { Product, ProductImage, ProductVariant } from "@/lib/types";

type ProductRow = Partial<Product> & {
  id?: string;
  name?: string | null;
  description?: string | null;
  currency?: string | null;
  active?: boolean | null;
  is_active?: boolean | null;
  status?: string | null;
  published?: boolean | null;
  seller_id?: string | null;
  category?: Product["category"] | Product["category"][] | null;
  images?: ProductImage[] | null;
  variants?: ProductVariant[] | null;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string | null;
  image_url?: string | null;
  is_featured?: boolean | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
  if (typeof value === "string") {
    const parsed = value.trim().toLowerCase();
    if (["true", "1", "yes", "active", "published", "enabled"].includes(parsed)) return true;
    if (["false", "0", "no", "inactive", "disabled"].includes(parsed)) return false;
  }
  return null;
}

function parseVisibilityStatus(value: unknown): boolean | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["active", "published", "live", "approved", "visible"].includes(normalized)) return true;
  if (["draft", "archived", "inactive", "hidden", "deleted", "blocked", "disabled", "private"].includes(normalized)) return false;
  return null;
}

function isProductVisibleForStorefront(product: ProductRow) {
  const signals = [
    parseBoolean(product.active),
    parseBoolean(product.is_active),
    parseBoolean(product.published),
    parseVisibilityStatus(product.status),
  ].filter((signal): signal is boolean => typeof signal === "boolean");

  if (!signals.length) return true;
  return signals.some(Boolean);
}

function normalizeProduct(row: ProductRow): Product {
  const category = Array.isArray(row.category) ? (row.category[0] ?? null) : (row.category ?? null);
  const images = Array.isArray(row.images) ? row.images.filter((image) => Boolean(image?.url)) : [];
  const variants = Array.isArray(row.variants) ? row.variants : [];
  const basePrice = typeof row.base_price_cents === "number" ? row.base_price_cents : null;
  const regularPrice = typeof row.price_cents === "number" ? row.price_cents : null;
  const activeSignal = parseBoolean(row.active) ?? parseBoolean(row.is_active) ?? parseBoolean(row.published);

  return {
    id: row.id ?? "",
    name: (row.name ?? row.item_description ?? "Producto").toString(),
    description: row.description ?? null,
    currency: row.currency === "USD" ? "USD" : "USD",
    base_price_cents: basePrice,
    price_cents: regularPrice,
    base_stock: typeof row.base_stock === "number" ? row.base_stock : Math.max(Number(row.qty ?? 0), 0),
    has_variants: Boolean(row.has_variants ?? variants.length > 0),
    active: activeSignal ?? true,
    featured: Boolean(row.featured),
    featured_rank: typeof row.featured_rank === "number" ? row.featured_rank : 0,
    category_id: row.category_id ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    sku: row.sku ?? null,
    item_number: row.item_number ?? null,
    department: row.department ?? null,
    item_description: row.item_description ?? null,
    seller_category: row.seller_category ?? null,
    condition: row.condition ?? null,
    qty: typeof row.qty === "number" ? row.qty : 0,
    image_url: row.image_url ?? null,
    redeemable: Boolean(row.redeemable),
    points_price: typeof row.points_price === "number" ? row.points_price : null,
    created_at: row.created_at ?? new Date(0).toISOString(),
    updated_at: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
    category: category && typeof category === "object" ? category : null,
    images,
    variants,
  };
}

function normalizeCategoryRow(row: CategoryRow): CatalogCategory {
  return {
    id: row.id,
    name: row.name,
    slug: normalizeCategorySlug(row.slug ?? row.name),
    imageUrl: row.image_url ?? null,
    description: null,
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

function sortProductsForStorefront(products: Product[]) {
  return [...products].sort((a, b) => {
    const createdA = Number.isFinite(Date.parse(a.created_at)) ? Date.parse(a.created_at) : 0;
    const createdB = Number.isFinite(Date.parse(b.created_at)) ? Date.parse(b.created_at) : 0;
    if (createdB !== createdA) return createdB - createdA;

    if (Number(b.featured) !== Number(a.featured)) return Number(b.featured) - Number(a.featured);
    return a.name.localeCompare(b.name);
  });
}

async function enrichProductsWithRelations(sb: Awaited<ReturnType<typeof getServerSupabase>>, products: Product[]) {
  if (!products.length) return products;

  const productIds = products.map((product) => product.id).filter(Boolean);
  const productsById = new Map<string, Product>(
    products.map((product) => [product.id, { ...product, images: [] as ProductImage[], variants: [] as ProductVariant[] }]),
  );

  const { data: images, error: imageError } = await sb
    .from("product_images")
    .select("id,product_id,url,sort_order")
    .in("product_id", productIds)
    .order("sort_order", { ascending: true });

  if (imageError) {
    console.error("[catalog.enrichProductsWithRelations] images error", imageError);
  } else {
    for (const image of (images ?? []) as ProductImage[]) {
      const product = productsById.get(image.product_id);
      if (!product) continue;
      product.images = [...(product.images ?? []), image];
    }
  }

  const { data: variants, error: variantError } = await sb
    .from("product_variants")
    .select("id,product_id,variant_name,attributes,price_cents,stock,sku,active")
    .in("product_id", productIds);

  if (variantError) {
    console.error("[catalog.enrichProductsWithRelations] variants error", variantError);
  } else {
    for (const variant of (variants ?? []) as ProductVariant[]) {
      const product = productsById.get(variant.product_id);
      if (!product) continue;
      product.variants = [...(product.variants ?? []), variant];
    }
  }

  const categoryIds = [...new Set(products.map((product) => product.category_id).filter((value): value is string => Boolean(value)))];
  if (categoryIds.length > 0) {
    const { data: categories, error: categoryError } = await sb
      .from("categories")
      .select("id,name,slug")
      .in("id", categoryIds);

    if (categoryError) {
      console.error("[catalog.enrichProductsWithRelations] categories error", categoryError);
    } else {
      const categoryMap = new Map((categories ?? []).map((category) => [category.id, category]));
      for (const product of productsById.values()) {
        if (!product.category_id) continue;
        const category = categoryMap.get(product.category_id);
        if (!category) continue;
        product.category = category;
      }
    }
  }

  return [...productsById.values()];
}

export async function fetchProductsBase() {
  const sb = await getServerSupabase();
  const { data, error } = await sb.from("products").select("*").order("created_at", { ascending: false });

  if (error) {
    console.error("[catalog.fetchProductsBase] public error", error);
    return [];
  }

  const rows = (data ?? []) as ProductRow[];
  console.info("[catalog.fetchProductsBase] rows", rows.length);
  return rows.map(normalizeProduct).filter((product) => Boolean(product.id));
}

export async function getProductsPublic() {
  const sb = await getServerSupabase();
  const baseProducts = await fetchProductsBase();
  const visibleProducts = baseProducts.filter((product) => isProductVisibleForStorefront(product));
  const enriched = await enrichProductsWithRelations(sb, visibleProducts);
  console.info("[catalog.getProductsPublic] visible rows", enriched.length);
  return sortProductsForStorefront(enriched);
}

export async function getProductsAdmin() {
  const admin = getServiceSupabase();
  const { data, error } = await admin.from("products").select("*").order("created_at", { ascending: false });

  if (error) {
    console.error("[catalog.getProductsAdmin] error", error);
    return [];
  }

  const rows = (data ?? []) as ProductRow[];
  const normalized = rows.map(normalizeProduct).filter((product) => Boolean(product.id));
  const enriched = await enrichProductsWithRelations(admin as unknown as Awaited<ReturnType<typeof getServerSupabase>>, normalized);
  console.info("[catalog.getProductsAdmin] rows", enriched.length);
  return enriched;
}

export async function getProductsForSeller(sellerId: string) {
  const sb = await getServerSupabase();
  const { data, error } = await sb.from("products").select("*").eq("seller_id", sellerId).order("created_at", { ascending: false });

  if (error) {
    console.error("[catalog.getProductsForSeller] error", error);
    return [];
  }

  const rows = (data ?? []) as ProductRow[];
  const normalized = rows.map(normalizeProduct).filter((product) => Boolean(product.id));
  const enriched = await enrichProductsWithRelations(sb, normalized);
  console.info("[catalog.getProductsForSeller] rows", enriched.length);
  return enriched;
}

export async function getCategories(products?: Product[]) {
  const sourceProducts = products ?? (await getProductsPublic());
  const sb = await getServerSupabase();

  const categorySelect = "id,name,slug,image_url,is_featured,sort_order,is_active";
  const { data: categoryRows, error } = await sb.from("categories").select(categorySelect);

  if (error) {
    console.error("[catalog.getCategories] error", error);

    const { data: minimalRows, error: minimalError } = await sb.from("categories").select("id,name,slug");
    if (minimalError) {
      console.error("[catalog.getCategories] minimal error", minimalError);
      return buildCatalogCategories(sourceProducts);
    }

    const minimal = ((minimalRows ?? []) as Array<Pick<CategoryRow, "id" | "name" | "slug">>).map((row) =>
      normalizeCategoryRow({ ...row, image_url: null, is_featured: false, sort_order: 0, is_active: true }),
    );

    const mergedMinimal = mergeCategoriesWithProducts(minimal, sourceProducts);
    console.info("[catalog.getCategories] rows", mergedMinimal.length);
    return mergedMinimal;
  }

  const normalized = ((categoryRows ?? []) as CategoryRow[]).map(normalizeCategoryRow);
  const merged = mergeCategoriesWithProducts(normalized, sourceProducts);
  console.info("[catalog.getCategories] rows", merged.length);
  return merged;
}

export async function getVisibleCategories(products?: Product[]) {
  const sourceProducts = products ?? (await getProductsPublic());
  const categories = await getCategories(sourceProducts);
  const visible = categories.filter((category) => category.productCount > 0);
  console.info("[catalog.getVisibleCategories] rows", visible.length);
  return visible;
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
  const products = await getProductsPublic();
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

export async function getProductById(id: string) {
  const sb = await getServerSupabase();
  const { data, error } = await sb.from("products").select("*").eq("id", id).single();

  if (error) {
    console.error("[catalog.getProductById] error", error);
    return null;
  }

  const product = normalizeProduct((data ?? {}) as ProductRow);
  const [enriched] = await enrichProductsWithRelations(sb, [product]);
  return enriched;
}

export async function getTopSelling(days = 30) {
  const admin = getServiceSupabase();
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const { data, error } = await admin
    .from("order_items")
    .select("product_id, qty, unit_price_cents_snapshot, products(name)")
    .gte("created_at", since as never);

  if (error) {
    console.error("[catalog.getTopSelling] error", error);
    return [];
  }

  return data ?? [];
}
