import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { cartItemSchema } from "@/lib/schemas";

const cartItemsSchema = z.array(cartItemSchema).min(1).max(25);

type CartInputItem = z.infer<typeof cartItemSchema>;

export type ValidatedCartItem = {
  product_id: string;
  variant_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  weight_grams: number;
};

export type ValidatedCart = {
  items: ValidatedCartItem[];
  subtotal_cents: number;
  total_weight_grams: number;
};

export function parseCartItems(payload: unknown) {
  return cartItemsSchema.safeParse(payload);
}

async function fetchVariantWithWeight(sb: SupabaseClient, variantId: string) {
  const withWeight = await sb
    .from("product_variants")
    .select("id,product_id,variant_name,price_cents,stock,active,weight_grams,products(name,active,weight_grams)")
    .eq("id", variantId)
    .single();

  if (!withWeight.error) return withWeight.data;

  if (!withWeight.error.message.includes("weight_grams")) {
    throw withWeight.error;
  }

  const fallback = await sb
    .from("product_variants")
    .select("id,product_id,variant_name,price_cents,stock,active,products(name,active)")
    .eq("id", variantId)
    .single();

  if (fallback.error) throw fallback.error;
  return fallback.data;
}

async function fetchProductWithWeight(sb: SupabaseClient, productId: string) {
  const withWeight = await sb
    .from("products")
    .select("id,name,active,has_variants,base_price_cents,base_stock,weight_grams")
    .eq("id", productId)
    .single();

  if (!withWeight.error) return withWeight.data;

  if (!withWeight.error.message.includes("weight_grams")) {
    throw withWeight.error;
  }

  const fallback = await sb
    .from("products")
    .select("id,name,active,has_variants,base_price_cents,base_stock")
    .eq("id", productId)
    .single();

  if (fallback.error) throw fallback.error;
  return fallback.data;
}

export async function validateCartItems(sb: SupabaseClient, rawItems: CartInputItem[]): Promise<ValidatedCart> {
  const validatedItems: ValidatedCartItem[] = [];

  for (const item of rawItems) {
    if (item.variantId) {
      const variant = await fetchVariantWithWeight(sb, item.variantId);
      const product = Array.isArray(variant?.products) ? variant?.products[0] : variant?.products;
      const unitPriceCents = Number(variant?.price_cents ?? 0);

      if (!variant?.active || !product?.active || variant.stock < item.qty || unitPriceCents <= 0) {
        throw new Error(`Producto variante inválido o sin stock: ${item.variantId}`);
      }

      const unitWeight = Math.max(50, Number((variant as { weight_grams?: number }).weight_grams ?? (product as { weight_grams?: number } | undefined)?.weight_grams ?? 500));
      validatedItems.push({
        product_id: variant.product_id,
        variant_id: variant.id,
        product_name_snapshot: `${product?.name ?? "Producto"} - ${variant.variant_name}`,
        quantity: item.qty,
        unit_price_cents: unitPriceCents,
        line_total_cents: unitPriceCents * item.qty,
        weight_grams: unitWeight * item.qty,
      });
      continue;
    }

    const product = await fetchProductWithWeight(sb, item.productId!);
    const unitPriceCents = Number(product?.base_price_cents ?? 0);

    if (!product?.active || product.has_variants || product.base_stock < item.qty || unitPriceCents <= 0) {
      throw new Error(`Producto inválido o sin stock: ${item.productId}`);
    }

    const unitWeight = Math.max(50, Number((product as { weight_grams?: number }).weight_grams ?? 500));
    validatedItems.push({
      product_id: product.id,
      variant_id: null,
      product_name_snapshot: product.name,
      quantity: item.qty,
      unit_price_cents: unitPriceCents,
      line_total_cents: unitPriceCents * item.qty,
      weight_grams: unitWeight * item.qty,
    });
  }

  return {
    items: validatedItems,
    subtotal_cents: validatedItems.reduce((acc, item) => acc + item.line_total_cents, 0),
    total_weight_grams: validatedItems.reduce((acc, item) => acc + item.weight_grams, 0),
  };
}
