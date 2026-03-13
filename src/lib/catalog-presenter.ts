import { Product } from "@/lib/types";

const FALLBACK_CATEGORY = "Home Essentials";

function titleize(value: string) {
  return value
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function getDisplayName(product: Product) {
  const raw = product.name || product.item_description || "Premium Product";
  return titleize(raw);
}

export function getDisplayCategory(product: Product) {
  const raw = product.category?.name || product.department || product.seller_category || FALLBACK_CATEGORY;
  return titleize(raw);
}

export function getDisplayPriceCents(product: Product) {
  const variantPrice = product.variants?.length ? Math.min(...product.variants.map((variant) => variant.price_cents || 0).filter((price) => price > 0)) : null;
  const base = variantPrice || product.base_price_cents || 0;
  return base > 0 ? base : null;
}

export function getCompareAtPriceCents(product: Product, currentPrice: number | null) {
  const compareAt = product.price_cents || 0;
  if (!currentPrice) return null;
  return compareAt > currentPrice ? compareAt : null;
}

export function getStockCount(product: Product) {
  return Math.max(product.base_stock ?? product.qty ?? 0, 0);
}

export function getPrimaryImage(product: Product) {
  const images = [...(product.images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  return {
    primary: images[0]?.url || product.image_url || null,
    secondary: images[1]?.url || null,
  };
}
