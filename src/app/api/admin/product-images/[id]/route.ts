import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  await auth.supabase.from("product_images").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
