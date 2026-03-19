import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { requireUserApi } from "@/lib/auth";
import { reviewSchema } from "@/lib/schemas";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await getServerSupabase();

  const { data, error } = await sb
    .from("reviews")
    .select("id,product_id,user_id,rating,comment,status,created_at")
    .eq("product_id", id)
    .eq("status", "visible")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = reviewSchema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: orders, error: ordersError } = await auth.supabase
    .from("orders")
    .select("id,order_items(product_id,variant_id)")
    .eq("user_id", auth.user.id)
    .eq("status", "paid");

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 400 });
  }

  const canReview = (orders ?? []).some(
    (order: { order_items: Array<{ product_id: string }> }) =>
      order.order_items.some((item: { product_id: string }) => item.product_id === id)
  );

  if (!canReview) {
    return NextResponse.json({ error: "Purchase required" }, { status: 403 });
  }

  const payload = {
    product_id: id,
    user_id: auth.user.id,
    rating: parsed.data.rating,
    comment: parsed.data.comment.trim(),
    status: "visible",
  };

  const { data, error } = await auth.supabase
    .from("reviews")
    .upsert(payload, { onConflict: "product_id,user_id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}