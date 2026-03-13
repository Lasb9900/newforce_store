import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/schemas";
import { getServerSupabase } from "@/lib/supabase";

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unexpected login error";
}

export async function POST(req: Request) {
  const payload = loginSchema.safeParse(await req.json());
  if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

  const supabase = await getServerSupabase();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.data.email,
      password: payload.data.password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (!data.user) {
      return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });
    }

    console.info("[LOGIN_DEBUG] server-login-success", { userId: data.user.id, render: "server" });
    return NextResponse.json({ ok: true, userId: data.user.id });
  } catch (error) {
    const message = toErrorMessage(error);
    console.error("/api/auth/login failed", message);

    if (message.includes("ENOTFOUND") || message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
      return NextResponse.json(
        {
          error:
            "No se pudo conectar con Supabase para autenticar. Revisa NEXT_PUBLIC_SUPABASE_URL y que el proyecto esté disponible.",
          details: message,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
