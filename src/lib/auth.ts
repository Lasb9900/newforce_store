import "server-only";

import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase";

export async function requireUserApi() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { supabase, user };
}

export async function requireOwnerApi() {
  const base = await requireUserApi();
  if ("error" in base) return base;

  const { data: profile } = await base.supabase
    .from("profiles")
    .select("role")
    .eq("user_id", base.user.id)
    .single();

  if (profile?.role !== "owner") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return base;
}

export async function requireOwnerPage() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).single();
  if (profile?.role !== "owner") redirect("/admin/login");

  return { supabase, user };
}
