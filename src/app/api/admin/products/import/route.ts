import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";

const REQUIRED_HEADERS = ["item #", "department", "item description", "qty", "seller category", "category", "condition"] as const;

type CsvRow = {
  itemNumber: string;
  department: string;
  itemDescription: string;
  qty: number;
  sellerCategory: string;
  category: string;
  condition: string;
};

function normalizeHeader(header: string) {
  return header.replace(/\s+/g, " ").trim().toLowerCase();
}

function parseBoolean(value: string | undefined, fallback = false) {
  if (!value) return fallback;
  return ["1", "true", "yes", "si", "sí"].includes(value.trim().toLowerCase());
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseCsv(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) throw new Error("CSV vacío");

  const headersRaw = parseCsvLine(lines[0]);
  const headers = headersRaw.map(normalizeHeader);

  for (const header of REQUIRED_HEADERS) {
    if (!headers.includes(header)) {
      throw new Error(`Falta columna obligatoria: ${header}`);
    }
  }

  const idx = (header: string) => headers.indexOf(header);

  const rows: Array<{ line: number; data: CsvRow; active: boolean; featured: boolean }> = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);

    const itemNumber = values[idx("item #")]?.trim() || "";
    const department = values[idx("department")]?.trim() || "";
    const itemDescription = values[idx("item description")]?.trim() || "";
    const qtyRaw = values[idx("qty")]?.trim() || "";
    const sellerCategory = values[idx("seller category")]?.trim() || "";
    const category = values[idx("category")]?.trim() || "";
    const condition = values[idx("condition")]?.trim() || "";

    if (!itemNumber || !itemDescription || !qtyRaw || !category) {
      errors.push(`Línea ${i + 1}: faltan campos obligatorios (Item #, Item Description, Qty, Category)`);
      continue;
    }

    const qty = Number(qtyRaw);
    if (Number.isNaN(qty) || qty < 0) {
      errors.push(`Línea ${i + 1}: Qty inválido`);
      continue;
    }

    rows.push({
      line: i + 1,
      data: { itemNumber, department, itemDescription, qty, sellerCategory, category, condition },
      active: parseBoolean(values[idx("active")], true),
      featured: parseBoolean(values[idx("featured")], false),
    });
  }

  return { rows, errors };
}

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

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Debes adjuntar un archivo CSV" }, { status: 400 });
  }

  const text = await file.text();

  let parsed;
  try {
    parsed = parseCsv(text);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const summary = { imported: 0, updated: 0, failed: parsed.errors.length };
  const rowErrors = [...parsed.errors];

  const categoryNames = [...new Set(parsed.rows.map((r) => r.data.category).filter(Boolean))];
  const categorySlugs = categoryNames.map(slugifyCategory).filter(Boolean);

  const { data: existingCategories } = categorySlugs.length
    ? await auth.supabase.from("categories").select("id,name,slug").in("slug", categorySlugs)
    : { data: [] as Array<{ id: string; name: string; slug: string }> };

  const categoryMap = new Map((existingCategories ?? []).map((c) => [c.slug, c.id]));

  for (const category of categoryNames) {
    const slug = slugifyCategory(category);
    if (!slug || categoryMap.has(slug)) continue;

    const { data: created, error } = await auth.supabase
      .from("categories")
      .insert({ name: category, slug })
      .select("id,slug")
      .single();

    if (!error && created) {
      categoryMap.set(created.slug, created.id);
    }
  }

  for (const row of parsed.rows) {
    const categorySlug = slugifyCategory(row.data.category);
    const categoryId = categoryMap.get(categorySlug) ?? null;

    if (!categoryId) {
      summary.failed += 1;
      rowErrors.push(`Línea ${row.line}: no se pudo resolver Category '${row.data.category}'`);
      continue;
    }

    const payload = {
      sku: row.data.itemNumber,
      name: row.data.itemDescription,
      item_description: row.data.itemDescription,
      department: row.data.department || null,
      seller_category: row.data.sellerCategory || null,
      item_condition: row.data.condition || null,
      category_id: categoryId,
      base_stock: row.data.qty,
      active: row.active,
      featured: row.featured,
    };

    const { data: existingBySku } = await auth.supabase
      .from("products")
      .select("id")
      .eq("sku", row.data.itemNumber)
      .maybeSingle();

    if (existingBySku?.id) {
      const { error } = await auth.supabase.from("products").update(payload).eq("id", existingBySku.id);
      if (error) {
        summary.failed += 1;
        rowErrors.push(`Línea ${row.line}: ${error.message}`);
      } else {
        summary.updated += 1;
      }
      continue;
    }

    const { error } = await auth.supabase.from("products").insert({
      ...payload,
      base_price_cents: null,
      has_variants: false,
      featured_rank: 0,
      tags: [],
    });

    if (error) {
      summary.failed += 1;
      rowErrors.push(`Línea ${row.line}: ${error.message}`);
    } else {
      summary.imported += 1;
    }
  }

  return NextResponse.json({
    data: {
      summary,
      errors: rowErrors.slice(0, 30),
      expectedColumns: ["Item #", "Department", "Item Description", "Qty", "Seller Category", "Category", "Condition"],
    },
  });
}
