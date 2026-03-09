import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { adminProductSchema } from "@/lib/schemas";

function normalizeProductPayload(payload: Record<string, unknown>) {
  const sku = (payload.sku as string | null | undefined) ?? null;
  const itemNumber = (payload.item_number as string | null | undefined) ?? sku;
  const baseStock = (payload.base_stock as number | undefined) ?? 0;
  const qty = (payload.qty as number | undefined) ?? baseStock;
  const itemCondition = (payload.item_condition as string | null | undefined) ?? (payload.condition as string | null | undefined) ?? null;

  return {
    ...payload,
    sku,
    item_number: itemNumber,
    base_stock: baseStock,
    qty,
    item_condition: itemCondition,
    condition: itemCondition,
  };
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = adminProductSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const payload = normalizeProductPayload(parsed.data as Record<string, unknown>);
  const { data, error } = await auth.supabase.from("products").update(payload).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const { error } = await auth.supabase.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
