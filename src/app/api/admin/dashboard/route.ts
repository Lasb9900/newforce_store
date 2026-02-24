import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireOwner();
  if ("error" in auth) return auth.error;
  const range = Number(req.nextUrl.searchParams.get("range") ?? 30);
  const since = new Date(Date.now() - range * 24 * 3600 * 1000).toISOString();
  const { data: orders } = await auth.supabase.from("orders").select("id,total_cents,created_at,status").eq("status", "paid").gte("created_at", since);
  const { data: items } = await auth.supabase.from("order_items").select("product_id,qty,unit_price_cents_snapshot,name_snapshot");
  const revenue = (orders ?? []).reduce((sum, o) => sum + o.total_cents, 0);
  const orderCount = orders?.length ?? 0;
  const itemsSold = (items ?? []).reduce((sum, i) => sum + i.qty, 0);
  return NextResponse.json({
    data: {
      range,
      kpi: { revenue, orderCount, avgOrderValue: orderCount ? Math.round(revenue / orderCount) : 0, itemsSold },
      salesByDay: orders ?? [],
      topProducts: items ?? [],
    },
  });
}
