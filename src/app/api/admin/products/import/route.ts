import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";

const REQUIRED_HEADERS = ["item #", "department", "item description", "qty", "seller category", "category", "condition"] as const;

type ParsedInventoryRow = {
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

function parseInventoryCsv(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("CSV vacío");
  }

  const headersRaw = parseCsvLine(lines[0]);
  const normalizedHeaders = headersRaw.map(normalizeHeader);

  for (const required of REQUIRED_HEADERS) {
    if (!normalizedHeaders.includes(required)) {
      throw new Error(`Falta columna obligatoria: ${required}`);
    }
  }

  const headerIndex = (name: string) => normalizedHeaders.indexOf(name);

  const rows: Array<{ line: number; data: ParsedInventoryRow }> = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);

    const itemNumber = values[headerIndex("item #")]?.trim() ?? "";
    const department = values[headerIndex("department")]?.trim() ?? "";
    const itemDescription = values[headerIndex("item description")]?.trim() ?? "";
    const qtyRaw = values[headerIndex("qty")]?.trim() ?? "";
    const sellerCategory = values[headerIndex("seller category")]?.trim() ?? "";
    const category = values[headerIndex("category")]?.trim() ?? "";
    const condition = values[headerIndex("condition")]?.trim() ?? "";

    if (!itemNumber || !itemDescription || !qtyRaw || !category) {
      errors.push(`Línea ${i + 1}: faltan campos mínimos (Item #, Item Description, Qty, Category)`);
      continue;
    }

    const qty = Number(qtyRaw);
    if (Number.isNaN(qty)) {
      errors.push(`Línea ${i + 1}: Qty inválido`);
      continue;
    }

    rows.push({
      line: i + 1,
      data: {
        itemNumber,
        department,
        itemDescription,
        qty,
        sellerCategory,
        category,
        condition,
      },
    });
  }

  return { headersRaw, rows, errors };
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

  try {
    const parsed = parseInventoryCsv(text);

    return NextResponse.json({
      data: {
        mode: "parse_only",
        expectedColumns: ["Item #", "Department", "Item Description", "Qty", "Seller Category", "Category", "Condition"],
        sourceHeaders: parsed.headersRaw,
        summary: {
          parsedRows: parsed.rows.length,
          failedRows: parsed.errors.length,
          totalRows: parsed.rows.length + parsed.errors.length,
        },
        preview: parsed.rows.slice(0, 20).map((row) => ({ line: row.line, ...row.data })),
        errors: parsed.errors.slice(0, 30),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
