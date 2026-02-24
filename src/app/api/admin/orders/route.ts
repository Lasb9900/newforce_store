import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";

export async function GET() {
  const auth = await requireOwnerApi();
  if ("error" in auth) return auth.error;
  const { data } = await auth.supabase.from("orders").select("*").order("created_at", { ascending: false });
  return NextResponse.json({ data: data ?? [] });
}
