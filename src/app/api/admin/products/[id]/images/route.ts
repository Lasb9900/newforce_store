import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { url, sort_order = 0 } = await req.json();
  const { data } = await auth.supabase.from("product_images").insert({ product_id: id, url, sort_order }).select().single();
  return NextResponse.json({ data });
}
