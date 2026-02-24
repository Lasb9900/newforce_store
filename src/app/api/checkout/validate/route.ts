import { NextResponse } from "next/server";
import { createCheckoutSchema } from "@/lib/schemas";
import { createSupabaseServer } from "@/lib/supabase";

export async function POST(req: Request) {
  const parsed = createCheckoutSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const sb = await createSupabaseServer();
  const checked = [];
  for (const item of parsed.data.items) {
    if (item.variantId) {
      const { data } = await sb.from("product_variants").select("id,price_cents,stock,active").eq("id", item.variantId).single();
      checked.push({ ...item, valid: !!data?.active && data.stock >= item.qty, unitPriceCents: data?.price_cents });
    } else {
      const { data } = await sb.from("products").select("id,base_price_cents,base_stock,active").eq("id", item.productId!).single();
      checked.push({ ...item, valid: !!data?.active && data.base_stock >= item.qty, unitPriceCents: data?.base_price_cents });
    }
  }
  return NextResponse.json({ data: checked });
}
