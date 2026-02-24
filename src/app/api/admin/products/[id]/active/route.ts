import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { active } = await req.json();
  const { data } = await auth.supabase.from("products").update({ active }).eq("id", id).select().single();
  return NextResponse.json({ data });
}
