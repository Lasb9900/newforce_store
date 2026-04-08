import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { adminProductSchema } from "@/lib/schemas";

function normalizeProductPayload(payload: Record<string, unknown>) {
  const sku = (payload.sku as string | null | undefined) ?? null;
  const itemNumber = (payload.item_number as string | null | undefined) ?? sku;
  const baseStock = (payload.base_stock as number | undefined) ?? 0;
  const qty = (payload.qty as number | undefined) ?? baseStock;
  const basePrice = (payload.base_price_cents as number | null | undefined) ?? null;
  const priceCents = (payload.price_cents as number | null | undefined) ?? basePrice;
  const condition = (payload.condition as string | null | undefined) ?? null;
  const categoryText = (payload.category as string | null | undefined) ?? null;
  const vendor = (payload.vendor as string | null | undefined)?.trim() ?? null;
  const categoryCode = (payload.category_code as string | null | undefined)?.trim() ?? null;

  const unitRetailCents =
    typeof payload.unit_retail_cents === "number" ? payload.unit_retail_cents : null;
  const extRetailCents =
    typeof payload.ext_retail_cents === "number" ? payload.ext_retail_cents : null;
  const actualSalesPriceCents =
    typeof payload.actual_sales_price_cents === "number"
      ? payload.actual_sales_price_cents
      : null;

  const redeemable = Boolean(payload.redeemable);
  const pointsPrice =
    redeemable && typeof payload.points_price === "number" ? payload.points_price : null;

  return {
    ...payload,
    sku,
    item_number: itemNumber,
    base_stock: baseStock,
    qty,
    base_price_cents: basePrice,
    price_cents: priceCents,
    condition,
    category: categoryText,
    vendor,
    category_code: categoryCode,
    unit_retail_cents: unitRetailCents,
    ext_retail_cents: extRetailCents,
    actual_sales_price_cents: actualSalesPriceCents,
    redeemable,
    points_price: pointsPrice,
  };
}

export async function GET() {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;

  const { data } = await auth.supabase
    .from("products")
    .select("*, category_ref:categories(name,slug), variants:product_variants(*), images:product_images(*)");

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;

  const parsed = adminProductSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = normalizeProductPayload(parsed.data as Record<string, unknown>);
  const { data, error } = await auth.supabase.from("products").insert(payload).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}