import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartItem } from "@/lib/types";

type DbErrorShape = {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

type ProductImageRow = {
  url?: string | null;
  sort_order?: number | null;
};

type ProductRow = {
  id: string;
  name?: string | null;
  active?: boolean | null;
  has_variants?: boolean | null;
  base_price_cents?: number | null;
  base_stock?: number | null;
  sku?: string | null;
  image_url?: string | null;
};

type VariantRow = {
  id: string;
  product_id: string;
  variant_name?: string | null;
  price_cents?: number | null;
  stock?: number | null;
  active?: boolean | null;
  sku?: string | null;
};

export class CartApiError extends Error {
  step: string;
  details?: string | null;
  hint?: string | null;
  code?: string;

  constructor(step: string, error: unknown, fallbackMessage: string) {
    const err = (error ?? {}) as Partial<DbErrorShape>;
    super(err.message ?? fallbackMessage);
    this.name = "CartApiError";
    this.step = step;
    this.details = err.details ?? null;
    this.hint = err.hint ?? null;
    this.code = err.code;
  }
}

export type CartNotice = {
  type: "info" | "warning";
  message: string;
};

type CartInput = {
  productId?: string;
  variantId?: string | null;
  qty: number;
};

const MAX_ITEMS = 25;

function itemKey(item: Pick<CartItem, "productId" | "variantId">) {
  return item.variantId ? `variant:${item.variantId}` : `product:${item.productId}`;
}

function lineKey(item: Pick<CartItem, "productId" | "variantId">) {
  return itemKey(item);
}

function sortImages(images: ProductImageRow[]) {
  return [...images].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
}

async function getProductImages(sb: SupabaseClient, productId: string) {
  const { data, error } = await sb
    .from("product_images")
    .select("url,sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("[CART_DB_WARN] product_images.lookup_failed", {
      productId,
      message: error.message,
      code: error.code ?? null,
    });
    return [] as ProductImageRow[];
  }

  return (data ?? []) as ProductImageRow[];
}

export async function normalizeCartItems(sb: SupabaseClient, rawItems: CartInput[]) {
  const notices: CartNotice[] = [];
  const collected = new Map<string, CartItem>();

  for (const raw of rawItems.slice(0, MAX_ITEMS)) {
    const qty = Math.max(1, Math.trunc(Number(raw.qty) || 1));
    const resolved = raw.variantId
      ? await resolveVariantItem(sb, raw.variantId, qty, notices)
      : await resolveProductItem(sb, raw.productId, qty, notices);

    if (!resolved) continue;

    const key = itemKey(resolved);
    const prev = collected.get(key);
    if (!prev) {
      collected.set(key, resolved);
      continue;
    }

    const totalQty = prev.qty + resolved.qty;
    const maxStock = typeof prev.availableStock === "number" ? prev.availableStock : null;
    const clampedQty = maxStock !== null ? Math.min(totalQty, Math.max(1, maxStock)) : totalQty;

    if (clampedQty < totalQty) {
      notices.push({
        type: "warning",
        message: `Adjusted quantity for ${prev.name ?? "an item"} to available stock (${clampedQty}).`,
      });
    }

    collected.set(key, { ...prev, qty: clampedQty });
  }

  return { items: Array.from(collected.values()).slice(0, MAX_ITEMS), notices };
}

async function resolveVariantItem(
  sb: SupabaseClient,
  variantId: string,
  requestedQty: number,
  notices: CartNotice[],
) {
  const { data, error } = await sb
    .from("product_variants")
    .select(
      "id,product_id,variant_name,price_cents,stock,active,sku,products(id,name,active,sku,image_url,product_images(url,sort_order))",
    )
    .eq("id", variantId)
    .maybeSingle();

  console.log("[CART_VARIANT_LOOKUP]", {
    variantId,
    error: error?.message ?? null,
    found: Boolean(data),
    data,
  });

  if (error || !data) {
    console.log("[CART_VARIANT_REJECTED]", {
      variantId,
      reason: "variant_missing_or_query_error",
      error: error?.message ?? null,
    });

    notices.push({
      type: "warning",
      message: "A product variant was removed from your cart because it no longer exists.",
    });
    return null;
  }

  const product = Array.isArray(data.products) ? data.products[0] : data.products;

  console.log("[CART_VARIANT_PRODUCT]", {
    variantId,
    product,
  });

  if (!product) {
    console.log("[CART_VARIANT_REJECTED]", {
      variantId,
      reason: "product_missing",
    });

    notices.push({
      type: "warning",
      message: "A product variant was removed from your cart because its product no longer exists.",
    });
    return null;
  }

  if (data.active === false || product.active === false) {
    console.log("[CART_VARIANT_REJECTED]", {
      variantId,
      reason: "inactive",
      variantActive: data.active,
      productActive: product.active,
    });

    notices.push({
      type: "warning",
      message: `${product.name ?? "A product"} is unavailable and was removed from your cart.`,
    });
    return null;
  }

  const stock = Math.max(0, Number(data.stock ?? 0));
  if (stock < 1) {
    console.log("[CART_VARIANT_REJECTED]", {
      variantId,
      reason: "out_of_stock",
      stock: data.stock,
    });

    notices.push({
      type: "warning",
      message: `${product.name ?? "A product"} is out of stock and was removed from your cart.`,
    });
    return null;
  }

  const price = Number(data.price_cents ?? 0);
  if (price <= 0) {
    console.log("[CART_VARIANT_REJECTED]", {
      variantId,
      reason: "invalid_price",
      price: data.price_cents,
    });

    notices.push({
      type: "warning",
      message: `${product.name ?? "A product"} has no valid price and was removed from your cart.`,
    });
    return null;
  }

  const qty = Math.min(requestedQty, stock);
  if (qty < requestedQty) {
    notices.push({
      type: "warning",
      message: `Quantity for ${product.name ?? "item"} was adjusted to ${qty} due to stock.`,
    });
  }

  const images = Array.isArray(product.product_images)
    ? [...product.product_images].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    : [];

  console.log("[CART_VARIANT_ACCEPTED]", {
    variantId,
    productId: data.product_id,
    stock: data.stock,
    price: data.price_cents,
    imageFromImages: images[0]?.url ?? null,
    imageFromProduct: (product as { image_url?: string | null }).image_url ?? null,
  });

  return {
    productId: data.product_id,
    variantId: data.id,
    qty,
    name: product.name ?? "Product",
    unitPriceCents: price,
    variantName: data.variant_name ?? null,
    imageUrl: images[0]?.url ?? (product as { image_url?: string | null }).image_url ?? undefined,
    sku: data.sku ?? product.sku ?? null,
    availableStock: stock,
  } satisfies CartItem;
}

async function resolveProductItem(
  sb: SupabaseClient,
  productId: string | undefined,
  requestedQty: number,
  notices: CartNotice[],
) {
  if (!productId) return null;

  const { data: product, error } = await sb
    .from("products")
    .select("id,name,active,has_variants,base_price_cents,price_cents,base_stock,qty,sku,image_url")
    .eq("id", productId)
    .maybeSingle();

  if (error || !product) {
    notices.push({
      type: "warning",
      message: "A product was removed from your cart because it no longer exists.",
    });
    return null;
  }

  if (product.has_variants) {
    const { data: firstVariant, error: variantError } = await sb
      .from("product_variants")
      .select("id")
      .eq("product_id", product.id)
      .eq("active", true)
      .gt("stock", 0)
      .limit(1)
      .maybeSingle();

    if (variantError) {
      console.warn("[CART_DB_WARN] product_variant_fallback_failed", {
        productId: product.id,
        message: variantError.message,
        code: variantError.code ?? null,
      });
    }

    if (firstVariant?.id) {
      return resolveVariantItem(sb, firstVariant.id, requestedQty, notices);
    }

    notices.push({
      type: "warning",
      message: `${product.name ?? "A product"} requires a variant selection and was removed from your cart.`,
    });
    return null;
  }

  if (product.active === false) {
    notices.push({
      type: "warning",
      message: `${product.name ?? "A product"} is unavailable and was removed from your cart.`,
    });
    return null;
  }

  const stock = Math.max(0, Number(product.qty ?? product.base_stock ?? 0));
  if (stock < 1) {
    notices.push({
      type: "warning",
      message: `${product.name ?? "A product"} is out of stock and was removed from your cart.`,
    });
    return null;
  }

  const price = Number(product.price_cents ?? product.base_price_cents ?? 0);
  if (price <= 0) {
    notices.push({
      type: "warning",
      message: `${product.name ?? "A product"} has no valid price and was removed from your cart.`,
    });
    return null;
  }

  const qty = Math.min(requestedQty, stock);
  if (qty < requestedQty) {
    notices.push({
      type: "warning",
      message: `Quantity for ${product.name ?? "item"} was adjusted to ${qty} due to stock.`,
    });
  }

  return {
    productId: product.id,
    qty,
    name: product.name ?? "Product",
    unitPriceCents: price,
    imageUrl: product.image_url ?? undefined,
    sku: product.sku ?? null,
    availableStock: stock,
  } satisfies CartItem;
}

async function ensureUserCartId(sb: SupabaseClient, userId: string) {
  const { data: existing, error: findError } = await sb
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (findError) {
    throw new CartApiError("ensure_user_cart.find", findError, "Failed to query user cart");
  }

  if (existing?.id) return existing.id;

  const { data: inserted, error: insertError } = await sb
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (insertError) {
    throw new CartApiError("ensure_user_cart.insert", insertError, "Failed to create user cart");
  }

  return inserted.id;
}

export async function saveUserCart(sb: SupabaseClient, userId: string, items: CartItem[]) {
  const cartId = await ensureUserCartId(sb, userId);

  const { error: deleteError } = await sb.from("cart_items").delete().eq("cart_id", cartId);
  if (deleteError) {
    throw new CartApiError("save_cart.delete_items", deleteError, "Failed to clear previous cart items");
  }

  if (items.length > 0) {
    const rows = items.map((item) => ({
      cart_id: cartId,
      line_key: lineKey(item),
      product_id: item.productId,
      variant_id: item.variantId ?? null,
      quantity: item.qty,
      price_snapshot_cents: item.unitPriceCents ?? null,
    }));

    const { error: insertError } = await sb.from("cart_items").insert(rows);

    if (insertError) {
      const missingColumn =
        insertError.message.includes("line_key") ||
        insertError.message.includes("price_snapshot_cents");

      if (missingColumn) {
        console.warn("[CART_DB_DEBUG] save_cart.insert_legacy_fallback", {
          message: insertError.message,
          code: insertError.code ?? null,
        });

        const legacyRows = items.map((item) => ({
          cart_id: cartId,
          product_id: item.productId,
          variant_id: item.variantId ?? null,
          quantity: item.qty,
        }));

        const { error: legacyError } = await sb.from("cart_items").insert(legacyRows);
        if (legacyError) {
          throw new CartApiError(
            "save_cart.insert_items_legacy",
            legacyError,
            "Failed to save cart items in legacy schema",
          );
        }
      } else {
        throw new CartApiError("save_cart.insert_items", insertError, "Failed to save cart items");
      }
    }
  }

  const { error: touchError } = await sb
    .from("carts")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", cartId);

  if (touchError) {
    throw new CartApiError("save_cart.touch_cart", touchError, "Failed to update cart timestamp");
  }
}

export async function loadUserCart(sb: SupabaseClient, userId: string) {
  const cartId = await ensureUserCartId(sb, userId);

  const { data, error } = await sb
    .from("cart_items")
    .select("product_id,variant_id,quantity")
    .eq("cart_id", cartId);

  if (error) {
    throw new CartApiError("load_cart.fetch_items", error, "Failed to fetch cart items");
  }

  const rawItems = (data ?? []).map((row) => ({
    productId: row.product_id as string | undefined,
    variantId: (row.variant_id as string | null) ?? undefined,
    qty: Math.max(1, Number(row.quantity ?? 1)),
  }));

  const normalized = await normalizeCartItems(sb, rawItems);
  const hasChanges =
    JSON.stringify(rawItems.map((r) => ({ ...r, variantId: r.variantId ?? null }))) !==
    JSON.stringify(
      normalized.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? null,
        qty: i.qty,
      })),
    );

  if (hasChanges) {
    await saveUserCart(sb, userId, normalized.items);
  }

  return normalized;
}