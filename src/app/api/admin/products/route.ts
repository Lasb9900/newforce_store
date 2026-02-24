import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { adminProductSchema } from "@/lib/schemas";

export async function GET() {
  const auth = await requireOwner();
  if ("error" in auth) return auth.error;
  const { data } = await auth.supabase.from("products").select("*, variants:product_variants(*), images:product_images(*)");
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireOwner();
  if ("error" in auth) return auth.error;
  const parsed = adminProductSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await auth.supabase.from("products").insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
