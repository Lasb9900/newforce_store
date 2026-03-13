import { NextResponse } from "next/server";
import { shippingRatesSchema } from "@/lib/schemas";
import { getServerSupabase } from "@/lib/supabase";
import { validateCartItems } from "@/lib/checkout";
import { getShippingOptions } from "@/lib/services/shipping.service";

export async function POST(req: Request) {
  const parsed = shippingRatesSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const sb = await getServerSupabase();
    const cart = await validateCartItems(sb, parsed.data.items);

    const shippingResult = await getShippingOptions({
      subtotalCents: cart.subtotal_cents,
      destinationPostalCode: parsed.data.shipping.postal_code,
      destinationState: parsed.data.shipping.state,
      destinationCountry: parsed.data.shipping.country,
      weightGrams: cart.total_weight_grams,
    });

    return NextResponse.json({
      shipping_options: shippingResult.options,
      source: shippingResult.source,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
