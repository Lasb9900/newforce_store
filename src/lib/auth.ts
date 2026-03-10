import "server-only";

import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase";

export type AppRole = "admin" | "seller" | "customer" | "owner";

const ADMIN_ROLES: AppRole[] = ["admin", "owner"];
const SELLER_ROLES: AppRole[] = ["seller", ...ADMIN_ROLES];

export async function requireUserApi() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,first_name,last_name,email,phone")
    .eq("user_id", user.id)
    .maybeSingle();

  return { supabase, user, profile };
}

export async function requireAdminApi() {
  const base = await requireUserApi();
  if ("error" in base) return base;

  if (!ADMIN_ROLES.includes((base.profile?.role as AppRole) ?? "customer")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return base;
}

export async function requireSellerApi() {
  const base = await requireUserApi();
  if ("error" in base) return base;

  if (!SELLER_ROLES.includes((base.profile?.role as AppRole) ?? "customer")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return base;
}

export async function requireAdminPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  if (!ADMIN_ROLES.includes((profile?.role as AppRole) ?? "customer")) redirect("/login?next=/admin");

  return { supabase, user, profile };
}

export async function requireCustomerPage(redirectTo = "/login") {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(redirectTo);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,first_name,last_name,email,phone")
    .eq("user_id", user.id)
    .maybeSingle();

  return { supabase, user, profile };
}

// Backward compatible aliases
export const requireOwnerApi = requireAdminApi;
export const requireOwnerPage = requireAdminPage;
