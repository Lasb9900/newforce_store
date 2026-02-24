import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { adminVariantSchema } from "@/lib/schemas";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = adminVariantSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await auth.supabase.from("product_variants").update(parsed.data).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  await auth.supabase.from("product_variants").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
