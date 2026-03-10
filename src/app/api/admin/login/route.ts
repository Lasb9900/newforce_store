import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/schemas";
import { getServerSupabase } from "@/lib/supabase";

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unexpected admin login error";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const payload = loginSchema.safeParse(body);
  if (!payload.success) return NextResponse.json({ error: "Payload inválido" }, { status: 400 });

  const supabase = await getServerSupabase();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.data.email,
      password: payload.data.password,
    });

    if (error) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    if (!data.user) return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: "Error validando rol de usuario" }, { status: 500 });
    }

    if (!profile || !["admin", "owner"].includes(profile.role)) {
      await supabase.auth.signOut({ scope: "global" });
      return NextResponse.json({ error: "Tu usuario no tiene permisos de administrador" }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = toErrorMessage(error);
    console.error("/api/admin/login failed", message);

    if (message.includes("ENOTFOUND") || message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
      return NextResponse.json({ error: "Error de red con Supabase (URL/proyecto no disponible)" }, { status: 503 });
    }

    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
