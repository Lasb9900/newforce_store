import { createSupabaseServer } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { supabase, user: data.user };
}

export async function requireOwner() {
  const base = await requireUser();
  if ("error" in base) return base;
  const { data: profile } = await base.supabase.from("profiles").select("role").eq("user_id", base.user.id).single();
  if (profile?.role !== "owner") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return base;
}
