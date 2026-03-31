import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

type ParsedInventoryRow = {
  itemNumber: string;
  department: string;
  itemDescription: string;
  qty: number;
  sellerCategory: string;
  category: string;
  condition: string;
  unitRetail?: number | null;
};

function dollarsToCents(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value * 100);
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
      const itemNumber = String(row.itemNumber ?? "").trim();
      const itemDescription = String(row.itemDescription ?? "").trim();
      const department = String(row.department ?? "").trim();
      const sellerCategory = String(row.sellerCategory ?? "").trim();
      const category = String(row.category ?? "").trim();
      const condition = String(row.condition ?? "").trim();
      const qty = Number(row.qty ?? 0);

      if (!itemNumber || !itemDescription || !Number.isFinite(qty) || qty < 0) {
        failed += 1;
        errors.push(`Fila ${row.itemNumber || "sin item"}: datos inválidos`);
        continue;
      }

      const payload = {
        sku: itemNumber,
        item_number: itemNumber,
        name: itemDescription,
        department: department || null,
        item_description: itemDescription || null,
        seller_category: sellerCategory || null,
        category: category || null,
        condition: condition || null,
        qty,
        base_stock: qty,
        base_price_cents: dollarsToCents(row.unitRetail),
      };

      const { data: existing, error: existingError } = await supabase
        .from("products")
        .select("id")
        .eq("sku", itemNumber)
        .maybeSingle();

      if (existingError) {
        throw new Error(existingError.message);
      }

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from("products")
          .update(payload)
          .eq("id", existing.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        updated += 1;
      } else {
        const insertPayload = {
          ...payload,
          active: true,
          featured: false,
          featured_rank: 0,
          has_variants: false,
          redeemable: false,
          points_price: null,
          category_id: null,
          description: null,
          price_cents: null,
        };

        const { error: insertError } = await supabase
          .from("products")
          .insert(insertPayload);

        if (insertError) {
          throw new Error(insertError.message);
        }

        inserted += 1;
      }
    } catch (error) {
      failed += 1;
      errors.push(
        `Item ${row.itemNumber ?? "sin item"}: ${
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