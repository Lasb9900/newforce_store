import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartItem } from "@/lib/types";

export type CartNotice = {
  type: "info" | "warning";
  message: string;
};

type CartInput = {
  productId?: string;
  variantId?: string;
  qty: number;
};

const MAX_ITEMS = 25;

function itemKey(item: Pick<CartItem, "productId" | "variantId">) {
  return item.variantId ? `variant:${item.variantId}` : `product:${item.productId}`;
}

function lineKey(item: Pick<CartItem, "productId" | "variantId">) {
  return itemKey(item);
}

export async function normalizeCartItems(sb: SupabaseClient, rawItems: CartInput[]) {
  const notices: CartNotice[] = [];
  const collected = new Map<string, CartItem>();

  for (const raw of rawItems.slice(0, MAX_ITEMS)) {
    const qty = Math.max(1, Math.trunc(Number(raw.qty) || 1));
    const resolved = raw.variantId ? await resolveVariantItem(sb, raw.variantId, qty, notices) : await resolveProductItem(sb, raw.productId, qty, notices);

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
      notices.push({ type: "warning", message: `Adjusted quantity for ${prev.name ?? "an item"} to available stock (${clampedQty}).` });
    }
    collected.set(key, { ...prev, qty: clampedQty });
  }

  return { items: Array.from(collected.values()).slice(0, MAX_ITEMS), notices };
}

async function resolveVariantItem(sb: SupabaseClient, variantId: string, requestedQty: number, notices: CartNotice[]) {
  const { data, error } = await sb
    .from("product_variants")
    .select("id,product_id,variant_name,price_cents,stock,active,sku,products(id,name,active,sku,product_images(url,sort_order))")
    .eq("id", variantId)
    .maybeSingle();

  if (error || !data) {
    notices.push({ type: "warning", message: "A product variant was removed from your cart because it no longer exists." });
    return null;
  }

  const product = Array.isArray(data.products) ? data.products[0] : data.products;
  if (!data.active || !product?.active) {
    notices.push({ type: "warning", message: `${product?.name ?? "A product"} is inactive and was removed from your cart.` });
    return null;
  }

  const stock = Math.max(0, Number(data.stock ?? 0));
  if (stock < 1) {
    notices.push({ type: "warning", message: `${product?.name ?? "A product"} is out of stock and was removed from your cart.` });
    return null;
  }

  const price = Number(data.price_cents ?? 0);
  if (price <= 0) {
    notices.push({ type: "warning", message: `${product?.name ?? "A product"} has no valid price and was removed from your cart.` });
    return null;
  }

  const qty = Math.min(requestedQty, stock);
  if (qty < requestedQty) notices.push({ type: "warning", message: `Quantity for ${product?.name ?? "item"} was adjusted to ${qty} due to stock.` });

  const images = Array.isArray(product?.product_images) ? product.product_images : [];
  const sorted = [...images].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

  return {
    productId: data.product_id,
    variantId: data.id,
    qty,
    name: product?.name ?? "Product",
    unitPriceCents: price,
    variantName: data.variant_name,
    imageUrl: sorted[0]?.url ?? undefined,
    sku: data.sku ?? product?.sku ?? null,
    availableStock: stock,
  } satisfies CartItem;
}

async function resolveProductItem(sb: SupabaseClient, productId: string | undefined, requestedQty: number, notices: CartNotice[]) {
  if (!productId) return null;

  const { data, error } = await sb
    .from("products")
    .select("id,name,active,has_variants,base_price_cents,base_stock,sku,product_images(url,sort_order)")
    .eq("id", productId)
    .maybeSingle();

  if (error || !data) {
    notices.push({ type: "warning", message: "A product was removed from your cart because it no longer exists." });
    return null;
  }

  if (!data.active || data.has_variants) {
    notices.push({ type: "warning", message: `${data.name ?? "A product"} is unavailable and was removed from your cart.` });
    return null;
  }

  const stock = Math.max(0, Number(data.base_stock ?? 0));
  if (stock < 1) {
    notices.push({ type: "warning", message: `${data.name ?? "A product"} is out of stock and was removed from your cart.` });
    return null;
  }

  const price = Number(data.base_price_cents ?? 0);
  if (price <= 0) {
    notices.push({ type: "warning", message: `${data.name ?? "A product"} has no valid price and was removed from your cart.` });
    return null;
  }

  const qty = Math.min(requestedQty, stock);
  if (qty < requestedQty) notices.push({ type: "warning", message: `Quantity for ${data.name ?? "item"} was adjusted to ${qty} due to stock.` });

  const images = Array.isArray(data.product_images) ? data.product_images : [];
  const sorted = [...images].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

  return {
    productId: data.id,
    qty,
    name: data.name,
    unitPriceCents: price,
    imageUrl: sorted[0]?.url ?? undefined,
    sku: data.sku ?? null,
    availableStock: stock,
  } satisfies CartItem;
}

async function ensureUserCartId(sb: SupabaseClient, userId: string) {
  const { data: existing, error: findError } = await sb.from("carts").select("id").eq("user_id", userId).maybeSingle();
  if (findError) throw findError;
  if (existing?.id) return existing.id;

  const { data: inserted, error: insertError } = await sb.from("carts").insert({ user_id: userId }).select("id").single();
  if (insertError) throw insertError;
  return inserted.id;
}

export async function saveUserCart(sb: SupabaseClient, userId: string, items: CartItem[]) {
  const cartId = await ensureUserCartId(sb, userId);

  const { error: deleteError } = await sb.from("cart_items").delete().eq("cart_id", cartId);
  if (deleteError) throw deleteError;

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
    if (insertError) throw insertError;
  }

  await sb.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cartId);
}

export async function loadUserCart(sb: SupabaseClient, userId: string) {
  const cartId = await ensureUserCartId(sb, userId);
  const { data, error } = await sb.from("cart_items").select("product_id,variant_id,quantity").eq("cart_id", cartId);
  if (error) throw error;

  const rawItems = (data ?? []).map((row) => ({
    productId: row.product_id as string | undefined,
    variantId: (row.variant_id as string | null) ?? undefined,
    qty: Math.max(1, Number(row.quantity ?? 1)),
  }));

  const normalized = await normalizeCartItems(sb, rawItems);
  const hasChanges = JSON.stringify(rawItems.map((r) => ({ ...r, variantId: r.variantId ?? null }))) !== JSON.stringify(normalized.items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, qty: i.qty })));

  if (hasChanges) {
    await saveUserCart(sb, userId, normalized.items);
  }

  return normalized;
}
