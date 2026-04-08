import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";

const REQUIRED_HEADERS = [
  "department",
  "item description",
  "qty",
  "unit retail",
  "ext. retail",
  "sales price",
  "actual sales price",
  "vendor",
  "category code",
  "seller category",
  "category",
  "condition",
] as const;

type ParsedInventoryRow = {
  importKey: string;
  department: string;
  itemDescription: string;
  qty: number;
  sellerCategory: string;
  category: string;
  condition: string;
  unitRetail: number | null;
  extRetail: number | null;
  salesPrice: number | null;
  actualSalesPrice: number | null;
  vendor: string;
  categoryCode: string;
};

function normalizeHeader(header: string) {
  return header.replace(/\s+/g, " ").trim().toLowerCase();
}

function parseMoney(value: string | undefined) {
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

function slugifyPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function buildImportKey(input: {
  department: string;
  itemDescription: string;
  vendor: string;
  categoryCode: string;
  condition: string;
}) {
  const parts = [
    slugifyPart(input.department),
    slugifyPart(input.itemDescription),
    slugifyPart(input.vendor),
    slugifyPart(input.categoryCode),
    slugifyPart(input.condition),
  ].filter(Boolean);

  return parts.join("|");
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

  const parsedRows: ParsedInventoryRow[] = [];
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

    const department = row["department"]?.trim() ?? "";
    const itemDescription = row["item description"]?.trim() ?? "";
    const qtyRaw = row["qty"]?.trim() ?? "";
    const sellerCategory = row["seller category"]?.trim() ?? "";
    const category = row["category"]?.trim() ?? "";
    const condition = row["condition"]?.trim() ?? "";
    const vendor = row["vendor"]?.trim() ?? "";
    const categoryCode = row["category code"]?.trim() ?? "";

    const unitRetail = parseMoney(row["unit retail"]);
    const extRetail = parseMoney(row["ext. retail"]);
    const salesPrice = parseMoney(row["sales price"]);
    const actualSalesPrice = parseMoney(row["actual sales price"]);

    const qtyParsed = Number(qtyRaw);
    const qty = Number.isFinite(qtyParsed) && qtyParsed >= 0 ? qtyParsed : 0;

    const looksEmpty =
  !itemDescription &&
  !vendor &&
  !categoryCode &&
  !sellerCategory &&
  !category &&
  !condition &&
  !qtyRaw &&
  salesPrice == null &&
  unitRetail == null &&
  extRetail == null &&
  actualSalesPrice == null;

if (looksEmpty) {
  continue;
}

const rowErrors: string[] = [];

if (!itemDescription) {
  rowErrors.push("Item Description vacío");
}

if (salesPrice != null && salesPrice < 0) {
  rowErrors.push("Sales price inválido");
}

if (rowErrors.length) {
  errors.push(`Fila ${index + 1}: ${rowErrors.join(" | ")}`);
  continue;
}

    const importKey = buildImportKey({
      department,
      itemDescription,
      vendor,
      categoryCode,
      condition,
    });

    if (!importKey) {
      rowErrors.push("No se pudo generar la clave interna de importación");
    }

    if (rowErrors.length) {
      errors.push(`Fila ${index + 1}: ${rowErrors.join(" | ")}`);
      continue;
    }

    parsedRows.push({
      importKey,
      department,
      itemDescription,
      qty,
      sellerCategory,
      category,
      condition,
      unitRetail,
      extRetail,
      salesPrice,
      actualSalesPrice,
      vendor,
      categoryCode,
    });
  }

  return NextResponse.json({
    data: {
      preview: parsedRows.slice(0, 20),
      parsedRows,
      summary: {
        parsedRows: parsedRows.length,
        failedRows: errors.length,
      },
      errors,
    },
  });
}