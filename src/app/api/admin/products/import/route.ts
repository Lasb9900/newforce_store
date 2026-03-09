import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";

type CsvRow = {
  name: string;
  description: string | null;
  price_usd: number | null;
  stock: number;
  active: boolean;
  featured: boolean;
  sku: string | null;
  category_slug: string | null;
};

function parseBoolean(value: string | undefined, fallback = false) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "si", "sí"].includes(normalized);
}

function parseCsv(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) throw new Error("CSV vacío");

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const requiredHeaders = ["name"];

  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`Falta columna requerida: ${header}`);
    }
  }

  const index = (key: string) => headers.indexOf(key);

  const rows: Array<{ line: number; data: CsvRow }> = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i].split(",").map((v) => v.trim());

    const name = values[index("name")] || "";
    if (!name) {
      errors.push(`Línea ${i + 1}: name es obligatorio`);
      continue;
    }

    const priceRaw = values[index("price_usd")];
    const priceUsd = priceRaw ? Number(priceRaw) : null;
    if (priceRaw && Number.isNaN(priceUsd)) {
      errors.push(`Línea ${i + 1}: price_usd inválido`);
      continue;
    }

    const stockRaw = values[index("stock")];
    const stock = stockRaw ? Number(stockRaw) : 0;
    if (Number.isNaN(stock) || stock < 0) {
      errors.push(`Línea ${i + 1}: stock inválido`);
      continue;
    }

    const row: CsvRow = {
      name,
      description: values[index("description")] || null,
      price_usd: priceUsd,
      stock,
      active: parseBoolean(values[index("active")], true),
      featured: parseBoolean(values[index("featured")], false),
      sku: values[index("sku")] || null,
      category_slug: values[index("category_slug")] || null,
    };

    rows.push({ line: i + 1, data: row });
  }

  return { rows, errors, headers };
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

  const slugs = parsed.rows.map((r) => r.data.category_slug).filter(Boolean) as string[];
  const { data: categories } = slugs.length
    ? await auth.supabase.from("categories").select("id,slug").in("slug", slugs)
    : { data: [] as Array<{ id: string; slug: string }> };
  const categoryMap = new Map((categories ?? []).map((c) => [c.slug, c.id]));

  for (const row of parsed.rows) {
    const payload = {
      name: row.data.name,
      description: row.data.description,
      base_price_cents: row.data.price_usd == null ? null : Math.round(row.data.price_usd * 100),
      base_stock: row.data.stock,
      active: row.data.active,
      featured: row.data.featured,
      sku: row.data.sku,
      category_id: row.data.category_slug ? categoryMap.get(row.data.category_slug) ?? null : null,
    };

    if (row.data.category_slug && !categoryMap.has(row.data.category_slug)) {
      summary.failed += 1;
      rowErrors.push(`Línea ${row.line}: category_slug '${row.data.category_slug}' no existe`);
      continue;
    }

    if (row.data.sku) {
      const { data: existingBySku } = await auth.supabase
        .from("products")
        .select("id")
        .eq("sku", row.data.sku)
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
    }

    const { error } = await auth.supabase.from("products").insert(payload);
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
      expectedColumns: ["name", "description", "price_usd", "stock", "active", "featured", "sku", "category_slug"],
    },
  });
}
