import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createSupabaseServer();
  const { data: current } = await sb.from("products").select("category_id").eq("id", id).single();
  const { data } = await sb.from("products").select("*").eq("active", true).eq("category_id", current?.category_id).neq("id", id).limit(4);
  return NextResponse.json({ data: data ?? [] });
}
