import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { active } = await req.json();
  const { data } = await auth.supabase.from("product_variants").update({ active }).eq("id", id).select().single();
  return NextResponse.json({ data });
}
