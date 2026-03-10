import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { env } from "@/lib/env";

const REQUIRED_COLUMNS = [
  "item_number",
  "department",
  "item_description",
  "qty",
  "seller_category",
  "category",
  "condition",
  "image_url",
  "price_cents",
  "active",
  "featured",
] as const;

export async function GET() {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;

  const checks = await Promise.all(
    REQUIRED_COLUMNS.map(async (column) => {
      const { error } = await auth.supabase.from("products").select(column).limit(1);
      return {
        column,
        ok: !error,
        error: error?.message ?? null,
      };
    }),
  );

  const missing = checks.filter((c) => !c.ok).map((c) => c.column);

  return NextResponse.json({
    data: {
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      schemaUsed: "public (default; no .schema() override in products module)",
      requiredColumns: REQUIRED_COLUMNS,
      missingColumns: missing,
      checks,
      recommendation:
        missing.length > 0
          ? "Apply latest products migrations on the same Supabase project and run `notify pgrst, 'reload schema';`."
          : "All required columns are visible via PostgREST schema cache.",
    },
  });
}
