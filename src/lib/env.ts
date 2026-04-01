import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default("https://example.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default("dev-anon-key"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
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

function inferProjectRefFromDbUrl(dbUrl: URL): string | null {
  const userMatch = dbUrl.username.match(/(?:postgres|postgresql)\.([a-z0-9]{20})/i);
  if (userMatch?.[1]) return userMatch[1].toLowerCase();

  const hostMatch = dbUrl.hostname.match(/(?:db\.)?([a-z0-9]{20})\.(?:supabase\.co|supabase\.com)/i);
  if (hostMatch?.[1]) return hostMatch[1].toLowerCase();

  return null;
}

function normalizeSupabaseUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);

  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    if (process.env.NODE_ENV !== "production" && parsed.hostname === "postgresql") {
      parsed.protocol = "http:";
      parsed.hostname = "127.0.0.1";
      parsed.port = "54321";
    }

    return parsed.toString().replace(/\/$/, "");
  }

  if (parsed.protocol === "postgresql:" || parsed.protocol === "postgres:") {
    const projectRef = inferProjectRefFromDbUrl(parsed);
    if (projectRef) {
      return `https://${projectRef}.supabase.co`;
    }

    if (process.env.NODE_ENV !== "production") {
      return "http://127.0.0.1:54321";
    }
  }

  return "https://example.supabase.co";
}

function isMissing(value?: string) {
  return !value || !value.trim();
}

function isPlaceholderSupabaseUrl(value?: string) {
  return !value || value.includes("example.supabase.co");
}

function isPlaceholderAnonKey(value?: string) {
  return !value || value === "dev-anon-key";
}

function assertProductionEnv(config: {
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_SITE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}) {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const missing: string[] = [];

  if (!config.SUPABASE_URL || isPlaceholderSupabaseUrl(config.SUPABASE_URL)) {
    missing.push("SUPABASE_URL");
  }

  if (isPlaceholderSupabaseUrl(config.NEXT_PUBLIC_SUPABASE_URL)) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (isPlaceholderAnonKey(config.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (isMissing(config.NEXT_PUBLIC_SITE_URL) || config.NEXT_PUBLIC_SITE_URL.includes("localhost")) {
    missing.push("NEXT_PUBLIC_SITE_URL");
  }

  if (isMissing(config.SUPABASE_SERVICE_ROLE_KEY)) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (isMissing(config.STRIPE_SECRET_KEY)) {
    missing.push("STRIPE_SECRET_KEY");
  }

  if (isMissing(config.STRIPE_WEBHOOK_SECRET)) {
    missing.push("STRIPE_WEBHOOK_SECRET");
  }

  if (missing.length) {
    throw new Error(
      `[ENV] Missing or invalid production environment variables: ${missing.join(", ")}`
    );
  }
}

const parsedEnv = schema.parse(process.env);

const normalizedEnv = {
  ...parsedEnv,
  SUPABASE_URL: parsedEnv.SUPABASE_URL ? normalizeSupabaseUrl(parsedEnv.SUPABASE_URL) : undefined,
  NEXT_PUBLIC_SUPABASE_URL: normalizeSupabaseUrl(parsedEnv.NEXT_PUBLIC_SUPABASE_URL),
};

assertProductionEnv(normalizedEnv);

export const env = normalizedEnv;