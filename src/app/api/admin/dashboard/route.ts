import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const range = Number(req.nextUrl.searchParams.get("range") ?? 30);
  const since = new Date(Date.now() - range * 24 * 3600 * 1000).toISOString();

  const [{ data: kpi }, { data: orders }, { data: items }] = await Promise.all([
    auth.supabase.from("admin_sales_kpis").select("*").single(),
    auth.supabase.from("orders").select("id,total_cents,created_at,status,channel").eq("status", "paid").eq("payment_status", "paid").gte("created_at", since),
    auth.supabase.from("order_items").select("product_id,qty,line_total_cents,name_snapshot"),
  ]);

  return NextResponse.json({ data: { range, kpi, salesByDay: orders ?? [], topProducts: items ?? [] } });
}
