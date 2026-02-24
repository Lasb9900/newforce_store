import { z } from "zod";

export const uuidParamSchema = z.object({ id: z.string().uuid() });
export const productIdParamSchema = z.object({ productId: z.string().uuid() });

export const cartItemSchema = z
  .object({
    productId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    qty: z.number().int().positive(),
  })
  .refine((v) => Boolean(v.productId || v.variantId), "productId or variantId required");

export const createCheckoutSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(25),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(3).max(1000),
});

export const adminProductSchema = z.object({
  name: z.string().min(2),
  description: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).default([]),
  sku: z.string().nullable().optional(),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  featured_rank: z.number().int().default(0),
  has_variants: z.boolean().default(false),
  base_price_cents: z.number().int().nonnegative().nullable().optional(),
  base_stock: z.number().int().nonnegative().default(0),
});

export const adminVariantSchema = z.object({
  variant_name: z.string().min(1),
  attributes: z.record(z.string(), z.string()).default({}),
  price_cents: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  sku: z.string().nullable().optional(),
  active: z.boolean().default(true),
});
