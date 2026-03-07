import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default("https://example.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default("dev-anon-key"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  STRIPE_SUCCESS_URL: z.string().optional(),
  STRIPE_CANCEL_URL: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("product-images"),
});

function normalizeSupabaseUrl(rawUrl: string): string {
  // In some local setups, a Docker-internal hostname like "postgresql"
  // leaks into env vars and is not resolvable from the host process.
  if (process.env.NODE_ENV === "production") return rawUrl;

  const parsed = new URL(rawUrl);
  if (parsed.hostname !== "postgresql") {
    return parsed.toString().replace(/\/$/, "");
  }

  // Supabase local defaults to the API gateway on 54321 over HTTP.
  parsed.protocol = "http:";
  parsed.hostname = "127.0.0.1";
  parsed.port = "54321";

  return parsed.toString().replace(/\/$/, "");
}

const parsedEnv = schema.parse(process.env);

export const env = {
  ...parsedEnv,
  NEXT_PUBLIC_SUPABASE_URL: normalizeSupabaseUrl(parsedEnv.NEXT_PUBLIC_SUPABASE_URL),
};
