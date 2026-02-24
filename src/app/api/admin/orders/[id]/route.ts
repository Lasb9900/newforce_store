import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { data } = await auth.supabase.from("orders").select("*, items:order_items(*)").eq("id", id).single();
  return NextResponse.json({ data });
}
