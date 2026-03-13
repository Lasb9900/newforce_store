import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.info("[AUTH_DEBUG] server-session", { authenticated: !!user, userId: user?.id ?? null, render: "server" });
  return NextResponse.json({ authenticated: !!user, userId: user?.id ?? null, email: user?.email ?? null });
}
