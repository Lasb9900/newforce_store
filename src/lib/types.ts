export type Currency = "USD";

export type Product = {
  id: string;
  name: string;
  description: string | null;
  currency: Currency;
  base_price_cents: number | null;
  base_stock: number;
  has_variants: boolean;
  active: boolean;
  featured: boolean;
  featured_rank: number;
  category_id: string | null;
  tags: string[];
  sku: string | null;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string; slug: string } | null;
  images?: ProductImage[];
  variants?: ProductVariant[];
};

export type ProductVariant = {
  id: string;
  product_id: string;
  variant_name: string;
  attributes: Record<string, string>;
  price_cents: number;
  stock: number;
  sku: string | null;
  active: boolean;
};

export type ProductImage = {
  id: string;
  product_id: string;
  url: string;
  sort_order: number;
};

export type CartItem = {
  productId?: string;
  variantId?: string;
  qty: number;
  name?: string;
  unitPriceCents?: number;
  imageUrl?: string;
  variantName?: string | null;
};
