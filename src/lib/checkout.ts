import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { cartItemSchema } from "@/lib/schemas";

export const SHIPPING_RULES = {
  freeShippingThresholdCents: 10_000,
  standardShippingCents: 1_500,
} as const;

const cartItemsSchema = z.array(cartItemSchema).min(1).max(25);

type CartInputItem = z.infer<typeof cartItemSchema>;

export type ValidatedCartItem = {
  product_id: string;
  variant_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

export type ValidatedCart = {
  items: ValidatedCartItem[];
  subtotal_cents: number;
};

export function parseCartItems(payload: unknown) {
  return cartItemsSchema.safeParse(payload);
}

export async function validateCartItems(
  sb: SupabaseClient,
  rawItems: CartInputItem[],
): Promise<ValidatedCart> {
  const validatedItems: ValidatedCartItem[] = [];

  for (const item of rawItems) {
    if (item.variantId) {
      const { data: variant } = await sb
        .from("product_variants")
        .select("id,product_id,variant_name,price_cents,stock,active,products(name,active)")
        .eq("id", item.variantId)
        .single();

      const product = Array.isArray(variant?.products) ? variant?.products[0] : variant?.products;
      const unitPriceCents = Number(variant?.price_cents ?? 0);
      if (!variant?.active || !product?.active || variant.stock < item.qty || unitPriceCents <= 0) {
        throw new Error(`Producto variante inválido o sin stock: ${item.variantId}`);
      }

      validatedItems.push({
        product_id: variant.product_id,
        variant_id: variant.id,
        product_name_snapshot: `${product?.name ?? "Producto"} - ${variant.variant_name}`,
        quantity: item.qty,
        unit_price_cents: unitPriceCents,
        line_total_cents: unitPriceCents * item.qty,
      });
      continue;
    }

    const { data: product } = await sb
      .from("products")
      .select("id,name,active,has_variants,base_price_cents,base_stock")
      .eq("id", item.productId)
      .single();

    const unitPriceCents = Number(product?.base_price_cents ?? 0);
    if (!product?.active || product.has_variants || product.base_stock < item.qty || unitPriceCents <= 0) {
      throw new Error(`Producto inválido o sin stock: ${item.productId}`);
    }

    validatedItems.push({
      product_id: product.id,
      variant_id: null,
      product_name_snapshot: product.name,
      quantity: item.qty,
      unit_price_cents: unitPriceCents,
      line_total_cents: unitPriceCents * item.qty,
    });
  }

  return {
    items: validatedItems,
    subtotal_cents: validatedItems.reduce((acc, item) => acc + item.line_total_cents, 0),
  };
}

export function calculateShippingCents(subtotalCents: number) {
  if (subtotalCents >= SHIPPING_RULES.freeShippingThresholdCents) {
    return 0;
  }

  return SHIPPING_RULES.standardShippingCents;
}

export function calculateTaxCents() {
  return 0;
}
