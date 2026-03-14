import { CatalogCategory, buildCatalogCategories, getCategoryBySlug, normalizeCategorySlug } from "@/lib/categories";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase";
import { Product, ProductImage, ProductVariant } from "@/lib/types";

type CatalogContext = "public" | "admin" | "seller";

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
  description?: string | null;
  image_url?: string | null;
  is_featured?: boolean | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

const PRODUCT_SELECT = "*, category:categories(*), images:product_images(*), variants:product_variants(*)";

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

function sortProductsForStorefront(products: Product[]) {
  return [...products].sort((a, b) => {
    const createdA = Number.isFinite(Date.parse(a.created_at)) ? Date.parse(a.created_at) : 0;
    const createdB = Number.isFinite(Date.parse(b.created_at)) ? Date.parse(b.created_at) : 0;
    if (createdB !== createdA) return createdB - createdA;

    if (Number(b.featured) !== Number(a.featured)) return Number(b.featured) - Number(a.featured);
    return a.name.localeCompare(b.name);
  });
}

async function fetchProductsBase(context: CatalogContext): Promise<Product[]> {
  const sb = await getServerSupabase();
  const { data, error } = await sb.from("products").select(PRODUCT_SELECT).order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error(`[catalog.fetchProductsBase] ${context} error`, error);
    return [];
  }

  const rows = (data ?? []) as ProductRow[];
  console.info(`[catalog.fetchProductsBase] ${context} returned rows`, rows.length);
  return rows.map(normalizeProduct).filter((product) => Boolean(product.id));
}

export async function getProductsPublic() {
  const allProducts = await fetchProductsBase("public");
  const visibleProducts = allProducts.filter((product) => isProductVisibleForStorefront(product));
  console.info("[catalog.getProductsPublic] visible rows", visibleProducts.length);
  return sortProductsForStorefront(visibleProducts);
}

export async function getProductsAdmin() {
  const admin = getServiceSupabase();
  const { data, error } = await admin.from("products").select(PRODUCT_SELECT).order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("[catalog.getProductsAdmin] error", error);
    return [];
  }

  const rows = (data ?? []) as ProductRow[];
  console.info("[catalog.getProductsAdmin] returned rows", rows.length);
  return rows.map(normalizeProduct).filter((product) => Boolean(product.id));
}

export async function getProductsForSeller(sellerId: string) {
  const products = await fetchProductsBase("seller");
  const filtered = products.filter((product) => {
    const rawSellerId = (product as Product & { seller_id?: string | null }).seller_id;
    return rawSellerId ? rawSellerId === sellerId : true;
  });

  console.info("[catalog.getProductsForSeller] returned rows", filtered.length);
  return filtered;
}

export async function getCategories(products?: Product[]) {
  const sourceProducts = products ?? (await getProductsPublic());
  const sb = await getServerSupabase();

  const { data: categoryRows, error } = await sb
    .from("categories")
    .select("id,name,slug,description,image_url,is_featured,sort_order,is_active")
    .or("is_active.is.null,is_active.eq.true");

  if (error) {
    console.error("[catalog.getCategories] error", error);
    return buildCatalogCategories(sourceProducts);
  }

  const normalized = ((categoryRows ?? []) as CategoryRow[]).map(normalizeCategoryRow);
  const merged = mergeCategoriesWithProducts(normalized, sourceProducts);
  console.info("[catalog.getCategories] merged categories", merged.length);
  return merged;
}

export async function getVisibleCategories(products?: Product[]) {
  const sourceProducts = products ?? (await getProductsPublic());
  const categories = await getCategories(sourceProducts);
  const visible = categories.filter((category) => category.productCount > 0);
  console.info("[catalog.getVisibleCategories] visible categories", visible.length);
  return visible;
}

export async function getFeaturedCategories(products?: Product[], limit = 4) {
  const visible = await getVisibleCategories(products);
  const featured = visible.filter((category) => category.featured);
  const sortedFeatured = [...featured].sort((a, b) => b.productCount - a.productCount);

  if (sortedFeatured.length >= limit) {
    console.info("[catalog.getFeaturedCategories] using featured categories", sortedFeatured.length);
    return sortedFeatured.slice(0, limit);
  }

  const supplemental = visible.filter((category) => !sortedFeatured.some((item) => item.slug === category.slug));
  const selected = [...sortedFeatured, ...supplemental].slice(0, limit);
  console.info("[catalog.getFeaturedCategories] selected categories", selected.length);
  return selected;
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
  const { data, error } = await sb.from("products").select(PRODUCT_SELECT).eq("id", id).single();

  if (error) {
    console.error("[catalog.getProductById] error", error);
    return null;
  }

  return normalizeProduct((data ?? {}) as ProductRow);
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
