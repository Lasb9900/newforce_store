import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const sb = await createSupabaseServer();
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q");
  const query = sb.from("products").select("*, images:product_images(*), variants:product_variants(*)").eq("active", true);
  if (q) query.ilike("name", `%${q}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
