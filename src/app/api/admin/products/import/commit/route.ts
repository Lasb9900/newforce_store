import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerApi } from "@/lib/auth";

const importRowSchema = z.object({
  itemNumber: z.string().min(1),
  department: z.string().optional().default(""),
  itemDescription: z.string().min(1),
  qty: z.number(),
  sellerCategory: z.string().optional().default(""),
  category: z.string().min(1),
  condition: z.string().optional().default(""),
});

const commitSchema = z.object({ rows: z.array(importRowSchema).min(1).max(5000) });

function slugifyCategory(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: Request) {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;

  const parsed = commitSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const rows = parsed.data.rows;
  const summary = { inserted: 0, updated: 0, failed: 0 };
  const errors: string[] = [];

  const categoryNames = [...new Set(rows.map((r) => r.category).filter(Boolean))];
  const categorySlugs = categoryNames.map(slugifyCategory).filter(Boolean);

  const { data: existingCategories } = categorySlugs.length
    ? await auth.supabase.from("categories").select("id,name,slug").in("slug", categorySlugs)
    : { data: [] as Array<{ id: string; name: string; slug: string }> };

  const categoryMap = new Map((existingCategories ?? []).map((c) => [c.slug, c.id]));

  for (const category of categoryNames) {
    const slug = slugifyCategory(category);
    if (!slug || categoryMap.has(slug)) continue;

    const { data: created } = await auth.supabase
      .from("categories")
      .insert({ name: category, slug })
      .select("id,slug")
      .single();

    if (created) categoryMap.set(created.slug, created.id);
  }

  for (const [index, row] of rows.entries()) {
    const categoryId = categoryMap.get(slugifyCategory(row.category)) ?? null;
    if (!categoryId) {
      summary.failed += 1;
      errors.push(`Fila ${index + 1}: category inválida (${row.category})`);
      continue;
    }

    const payload = {
      sku: row.itemNumber,
      item_number: row.itemNumber,
      name: row.itemDescription,
      item_description: row.itemDescription,
      department: row.department || null,
      seller_category: row.sellerCategory || null,
      category: row.category || null,
      item_condition: row.condition || null,
      condition: row.condition || null,
      category_id: categoryId,
      base_stock: Math.max(0, Math.round(row.qty)),
      qty: Math.max(0, Math.round(row.qty)),
    };

    const { data: existing } = await auth.supabase
      .from("products")
      .select("id")
      .or(`sku.eq.${row.itemNumber},item_number.eq.${row.itemNumber}`)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await auth.supabase.from("products").update(payload).eq("id", existing.id);
      if (error) {
        summary.failed += 1;
        errors.push(`Fila ${index + 1}: ${error.message}`);
      } else {
        summary.updated += 1;
      }
      continue;
    }

    const { error } = await auth.supabase.from("products").insert({
      ...payload,
      active: true,
      featured: false,
      featured_rank: 0,
      has_variants: false,
      tags: [],
      base_price_cents: null,
    });

    if (error) {
      summary.failed += 1;
      errors.push(`Fila ${index + 1}: ${error.message}`);
    } else {
      summary.inserted += 1;
    }
  }

  return NextResponse.json({ data: { summary, errors: errors.slice(0, 40) } });
}
