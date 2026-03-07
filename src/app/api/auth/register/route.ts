import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/schemas";
import { getServerSupabase } from "@/lib/supabase";

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unexpected registration error";
}

export async function POST(req: Request) {
  const payload = registerSchema.safeParse(await req.json());
  if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

  const supabase = await getServerSupabase();

  try {
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: payload.data.email,
      password: payload.data.password,
      options: {
        data: {
          first_name: payload.data.first_name,
          last_name: payload.data.last_name,
          phone: payload.data.phone,
        },
      },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!signUpData.user) return NextResponse.json({ error: "User not created" }, { status: 500 });

    const { error: profileError } = await supabase.rpc("create_profile_for_user", {
      p_user_id: signUpData.user.id,
      p_email: payload.data.email,
      p_first_name: payload.data.first_name,
      p_last_name: payload.data.last_name,
      p_phone: payload.data.phone,
      p_role: "customer",
    });

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    return NextResponse.json({ ok: true, userId: signUpData.user.id });
  } catch (error) {
    const message = toErrorMessage(error);
    if (message.includes("ENOTFOUND") || message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
      return NextResponse.json(
        {
          error:
            "No se pudo conectar con Supabase. Verifica NEXT_PUBLIC_SUPABASE_URL (debe apuntar al gateway de API; en local normalmente http://127.0.0.1:54321).",
          details: message,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
