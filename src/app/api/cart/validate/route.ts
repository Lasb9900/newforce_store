import { NextResponse } from "next/server";
import { cartValidationSchema } from "@/lib/schemas";
import { getServerSupabase } from "@/lib/supabase";
import { validateCartItems } from "@/lib/checkout";

export async function POST(req: Request) {
  const parsed = cartValidationSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const sb = await getServerSupabase();
    const cart = await validateCartItems(sb, parsed.data.items);
    return NextResponse.json(cart);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
