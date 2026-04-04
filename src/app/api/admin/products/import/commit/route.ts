import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

type ParsedInventoryRow = {
  importKey: string;
  department: string;
  itemDescription: string;
  qty: number;
  sellerCategory: string;
  category: string;
  condition: string;
  unitRetail?: number | null;
  extRetail?: number | null;
  salesPrice?: number | null;
  actualSalesPrice?: number | null;
  vendor: string;
  categoryCode: string;
};

function dollarsToCents(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

function buildSyntheticSku(row: ParsedInventoryRow) {
  return `csv-${row.importKey}`.slice(0, 120);
}

export async function POST(req: Request) {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const rows = Array.isArray(body?.rows) ? (body.rows as ParsedInventoryRow[]) : [];

  if (!rows.length) {
    return NextResponse.json({ error: "No hay filas para importar" }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  let inserted = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const importKey = String(row.importKey ?? "").trim();
      const itemDescription = String(row.itemDescription ?? "").trim();
      const department = String(row.department ?? "").trim();
      const sellerCategory = String(row.sellerCategory ?? "").trim();
      const category = String(row.category ?? "").trim();
      const condition = String(row.condition ?? "").trim();
      const vendor = String(row.vendor ?? "").trim();
      const categoryCode = String(row.categoryCode ?? "").trim();
      const qty = Number(row.qty ?? 0);

      if (!itemDescription) {
  failed += 1;
  errors.push("Fila sin nombre de producto: datos inválidos");
  continue;
}

      const salesPriceCents = dollarsToCents(row.salesPrice);
      const unitRetailCents = dollarsToCents(row.unitRetail);
      const extRetailCents = dollarsToCents(row.extRetail);
      const actualSalesPriceCents = dollarsToCents(row.actualSalesPrice);
      const syntheticSku = buildSyntheticSku(row);

      const candidatesQuery = supabase
  .from("products")
  .select("id, base_price_cents, price_cents, item_description, vendor, category_code, condition, department, created_at")
  .eq("item_description", itemDescription);

if (vendor) {
  candidatesQuery.eq("vendor", vendor);
}

if (categoryCode) {
  candidatesQuery.eq("category_code", categoryCode);
}

const lookup = await candidatesQuery.limit(10);

if (lookup.error) {
  throw new Error(lookup.error.message);
}

const candidates = lookup.data ?? [];
const matchedProduct = candidates[0] ?? null;

      const basePayload = {
            sku: syntheticSku,
            item_number: importKey,
            name: itemDescription,
            department: department || null,
            item_description: itemDescription || null,
            seller_category: sellerCategory || null,
            category: category || null,
            condition: condition || null,
            vendor: vendor || null,
            category_code: categoryCode || null,
            qty,
            base_stock: qty,
            unit_retail_cents: unitRetailCents,
            ext_retail_cents: extRetailCents,
            actual_sales_price_cents: actualSalesPriceCents,
      };

      if (matchedProduct?.id) {
        const updatePayload = {
  ...basePayload,
  ...(salesPriceCents != null ? { price_cents: salesPriceCents } : {}),
  base_price_cents:
  matchedProduct.base_price_cents == null
    ? salesPriceCents ?? matchedProduct.base_price_cents
    : matchedProduct.base_price_cents,
};

        const { error: updateError } = await supabase
          .from("products")
          .update(updatePayload)
          .eq("id", matchedProduct.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        updated += 1;
      } else {
        const insertPayload = {
  ...basePayload,
  active: true,
  featured: false,
  featured_rank: 0,
  has_variants: false,
  redeemable: false,
  points_price: null,
  category_id: null,
  description: null,
  price_cents: salesPriceCents ?? 0,
  base_price_cents: salesPriceCents ?? 0,
};

        const { error: insertError } = await supabase.from("products").insert(insertPayload);

        if (insertError) {
          throw new Error(insertError.message);
        }

        inserted += 1;
      }
    } catch (error) {
      failed += 1;
      errors.push(
        `Item ${row.itemDescription ?? "sin descripción"}: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
      );
    }
  }

  return NextResponse.json({
    data: {
      summary: {
        inserted,
        updated,
        failed,
      },
      errors,
    },
  });
}