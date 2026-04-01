import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  STRIPE_SUCCESS_URL: z.string().optional(),
  STRIPE_CANCEL_URL: z.string().optional(),

  SUPABASE_STORAGE_BUCKET: z.string().default("product-images"),

  UPS_CLIENT_ID: z.string().optional(),
  UPS_CLIENT_SECRET: z.string().optional(),
  UPS_ACCOUNT_NUMBER: z.string().optional(),
  UPS_SHIPPER_ZIP: z.string().optional(),
  UPS_SHIPPER_COUNTRY: z.string().default("US"),
  UPS_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().email().optional(),
  EMAIL_REPLY_TO: z.string().email().optional(),
});

export const serverEnv = serverSchema.parse({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

  STRIPE_SUCCESS_URL: process.env.STRIPE_SUCCESS_URL,
  STRIPE_CANCEL_URL: process.env.STRIPE_CANCEL_URL,

  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,

  UPS_CLIENT_ID: process.env.UPS_CLIENT_ID,
  UPS_CLIENT_SECRET: process.env.UPS_CLIENT_SECRET,
  UPS_ACCOUNT_NUMBER: process.env.UPS_ACCOUNT_NUMBER,
  UPS_SHIPPER_ZIP: process.env.UPS_SHIPPER_ZIP,
  UPS_SHIPPER_COUNTRY: process.env.UPS_SHIPPER_COUNTRY,
  UPS_ENVIRONMENT: process.env.UPS_ENVIRONMENT,

  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
  EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
});