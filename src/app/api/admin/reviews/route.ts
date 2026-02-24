import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";

export async function GET() {
  const auth = await requireOwner();
  if ("error" in auth) return auth.error;
  const { data } = await auth.supabase.from("reviews").select("*").order("created_at", { ascending: false });
  return NextResponse.json({ data: data ?? [] });
}
