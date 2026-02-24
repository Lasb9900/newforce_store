import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { requireUserApi } from "@/lib/auth";
import { reviewSchema } from "@/lib/schemas";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await getServerSupabase();
  const { data } = await sb.from("reviews").select("*").eq("product_id", id).eq("status", "visible");
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserApi();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = reviewSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { data: orders } = await auth.supabase
    .from("orders")
    .select("id,order_items(product_id,variant_id)")
    .eq("user_id", auth.user.id)
    .eq("status", "paid");
  const canReview = (orders ?? []).some((o: { order_items: Array<{ product_id: string }> }) => o.order_items.some((it: { product_id: string }) => it.product_id === id));
  if (!canReview) return NextResponse.json({ error: "Purchase required" }, { status: 403 });
  const { data, error } = await auth.supabase.from("reviews").insert({ ...parsed.data, product_id: id, user_id: auth.user.id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
