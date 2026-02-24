import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { status } = await req.json();
  const { data } = await auth.supabase.from("reviews").update({ status }).eq("id", id).select().single();
  return NextResponse.json({ data });
}
