import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { data } = await auth.supabase.from("product_variants").update(await req.json()).eq("id", id).select().single();
  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  await auth.supabase.from("product_variants").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
