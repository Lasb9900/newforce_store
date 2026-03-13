import { NextResponse } from "next/server";
import { shippingRatesSchema } from "@/lib/schemas";
import { getServerSupabase } from "@/lib/supabase";
import { validateCartItems } from "@/lib/checkout";
import { buildShippingOptions } from "@/lib/shipping";

export async function POST(req: Request) {
  const parsed = shippingRatesSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const sb = await getServerSupabase();
    const cart = await validateCartItems(sb, parsed.data.items);
    return NextResponse.json({
      shipping_options: buildShippingOptions(cart.subtotal_cents),
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
