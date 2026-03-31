import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";

const REQUIRED_HEADERS = [
  "item #",
  "department",
  "item description",
  "qty",
  "seller category",
  "category",
  "condition",
  "unit retail",
] as const;

type ParsedInventoryRow = {
  itemNumber: string;
  department: string;
  itemDescription: string;
  qty: number;
  sellerCategory: string;
  category: string;
  condition: string;
  unitRetail: number | null;
};

function normalizeHeader(header: string) {
  return header.replace(/\s+/g, " ").trim().toLowerCase();
}

function parseUnitRetail(value: string | undefined) {
  if (!value) return null;

  const normalized = value.replace(/[$,\s]/g, "").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export async function POST(req: Request) {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Debes seleccionar un archivo CSV" }, { status: 400 });
  }

  const raw = await file.text();
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return NextResponse.json({ error: "El CSV no tiene suficientes filas" }, { status: 400 });
  }

  const headerValues = parseCsvLine(lines[0]).map(normalizeHeader);

  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headerValues.includes(header));
  if (missingHeaders.length) {
    return NextResponse.json(
      {
        error: `Faltan columnas requeridas: ${missingHeaders.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const preview: ParsedInventoryRow[] = [];
  const errors: string[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const rowValues = parseCsvLine(lines[index]);

    if (rowValues.every((value) => !String(value ?? "").trim())) {
      continue;
    }

    const row: Record<string, string> = {};
    for (let col = 0; col < headerValues.length; col += 1) {
      row[headerValues[col]] = rowValues[col] ?? "";
    }

    const itemNumber = row["item #"]?.trim() ?? "";
    const department = row["department"]?.trim() ?? "";
    const itemDescription = row["item description"]?.trim() ?? "";
    const qtyRaw = row["qty"]?.trim() ?? "";
    const sellerCategory = row["seller category"]?.trim() ?? "";
    const category = row["category"]?.trim() ?? "";
    const condition = row["condition"]?.trim() ?? "";
    const unitRetail = parseUnitRetail(row["unit retail"]);

    const qty = Number(qtyRaw);

    const rowErrors: string[] = [];
    if (!itemNumber) rowErrors.push("Item # vacío");
    if (!department) rowErrors.push("Department vacío");
    if (!itemDescription) rowErrors.push("Item Description vacío");
    if (!qtyRaw || !Number.isFinite(qty) || qty < 0) rowErrors.push("Qty inválido");
    if (!sellerCategory) rowErrors.push("Seller Category vacío");
    if (!category) rowErrors.push("Category vacío");
    if (!condition) rowErrors.push("Condition vacío");

    if (rowErrors.length) {
      errors.push(`Fila ${index + 1}: ${rowErrors.join(" | ")}`);
      continue;
    }

    preview.push({
      itemNumber,
      department,
      itemDescription,
      qty,
      sellerCategory,
      category,
      condition,
      unitRetail,
    });
  }

  return NextResponse.json({
    data: {
      preview: preview.slice(0, 20),
      parsedRows: preview,
      summary: {
        parsedRows: preview.length,
        failedRows: errors.length,
      },
      errors,
    },
  });
}