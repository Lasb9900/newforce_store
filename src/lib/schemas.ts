import { z } from "zod";
import { US_STATE_SET, US_ZIP_REGEX } from "@/lib/us-address";

export const uuidParamSchema = z.object({ id: z.string().uuid() });
export const productIdParamSchema = z.object({ productId: z.string().uuid() });

export const cartItemSchema = z
  .object({
    productId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    qty: z.number().int().positive(),
  })
  .refine((v) => Boolean(v.productId || v.variantId), "productId or variantId required");

export const checkoutShippingSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  address_line_1: z.string().min(3),
  address_line_2: z.string().max(200).optional(),
  city: z.string().min(2),
  state: z.string().transform((v) => v.toUpperCase()).refine((v) => US_STATE_SET.has(v), "Invalid US state"),
  postal_code: z.string().refine((v) => US_ZIP_REGEX.test(v), "Invalid US ZIP"),
  country: z.literal("US"),
  delivery_notes: z.string().max(1000).optional(),
});

export const createCheckoutSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(25),
  shipping: checkoutShippingSchema,
});

export const cartValidationSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(25),
});

export const shippingRatesSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(25),
  shipping: checkoutShippingSchema,
});

export const stripeCheckoutSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(25),
  shipping: checkoutShippingSchema,
  shipping_option_id: z.literal("standard"),
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
  item_number: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  item_description: z.string().nullable().optional(),
  seller_category: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  condition: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  featured_rank: z.number().int().default(0),
  has_variants: z.boolean().default(false),
  base_price_cents: z.number().int().nonnegative().nullable().optional(),
  price_cents: z.number().int().nonnegative().nullable().optional(),
  base_stock: z.number().int().nonnegative().default(0),
  qty: z.number().int().nonnegative().optional(),
});

export const adminVariantSchema = z.object({
  variant_name: z.string().min(1),
  attributes: z.record(z.string(), z.string()).default({}),
  price_cents: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  sku: z.string().nullable().optional(),
  active: z.boolean().default(true),
});


export const registerSchema = z.object({
  first_name: z.string().min(2),
  last_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  password: z.string().min(8),
});

export const posItemSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().positive(),
});

export const createPosSaleSchema = z.object({
  customerEmail: z.string().email().optional(),
  paymentMethod: z.enum(["cash", "card", "transfer"]).default("cash"),
  paymentReference: z.string().trim().min(1).optional(),
  items: z.array(posItemSchema).min(1),
});

export const createPosClosureSchema = z.object({
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
  actualCashCents: z.number().int().nonnegative(),
  actualCardCents: z.number().int().nonnegative(),
  actualTransferCents: z.number().int().nonnegative(),
  notes: z.string().max(2000).optional(),
});

export const redeemPointsSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().positive().max(20),
});


export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
