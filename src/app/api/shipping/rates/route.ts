import { NextResponse } from "next/server";
import { shippingRatesSchema } from "@/lib/schemas";
import { getServerSupabase } from "@/lib/supabase";
import { calculateShippingCents, validateCartItems } from "@/lib/checkout";

export async function POST(req: Request) {
  const parsed = shippingRatesSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const sb = await getServerSupabase();
    const cart = await validateCartItems(sb, parsed.data.items);
    const shippingCents = calculateShippingCents(cart.subtotal_cents);

    return NextResponse.json({
      shipping_options: [
        {
          id: "standard",
          name: "Standard Shipping",
          amount_cents: shippingCents,
        },
      ],
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
