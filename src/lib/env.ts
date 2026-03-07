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

function inferProjectRefFromDbUrl(dbUrl: URL): string | null {
  // Example username from Supabase DB URL: postgres.<project_ref>
  const userMatch = dbUrl.username.match(/(?:postgres|postgresql)\.([a-z0-9]{20})/i);
  if (userMatch?.[1]) return userMatch[1].toLowerCase();

  // Example host patterns that may include project ref.
  const hostMatch = dbUrl.hostname.match(/(?:db\.)?([a-z0-9]{20})\.(?:supabase\.co|supabase\.com)/i);
  if (hostMatch?.[1]) return hostMatch[1].toLowerCase();

  return null;
}

function normalizeSupabaseUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);

  // Already valid for supabase-js.
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    // In some local setups, a Docker-internal hostname like "postgresql"
    // leaks into env vars and is not resolvable from the host process.
    if (process.env.NODE_ENV !== "production" && parsed.hostname === "postgresql") {
      parsed.protocol = "http:";
      parsed.hostname = "127.0.0.1";
      parsed.port = "54321";
    }

    return parsed.toString().replace(/\/$/, "");
  }

  // If user pasted a Postgres connection string in NEXT_PUBLIC_SUPABASE_URL,
  // convert it to the Supabase API URL when we can infer the project ref.
  if (parsed.protocol === "postgresql:" || parsed.protocol === "postgres:") {
    const projectRef = inferProjectRefFromDbUrl(parsed);
    if (projectRef) {
      return `https://${projectRef}.supabase.co`;
    }

    // Fallback for local Supabase when a docker hostname leaked in.
    if (process.env.NODE_ENV !== "production") {
      return "http://127.0.0.1:54321";
    }
  }

  // Last safe fallback to avoid crashing the app shell with invalidsupabaseUrl.
  return "https://example.supabase.co";
}

const parsedEnv = schema.parse(process.env);

export const env = {
  ...parsedEnv,
  NEXT_PUBLIC_SUPABASE_URL: normalizeSupabaseUrl(parsedEnv.NEXT_PUBLIC_SUPABASE_URL),
};
