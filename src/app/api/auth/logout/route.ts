import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unexpected logout error";
}

export async function POST() {
  const supabase = await getServerSupabase();

  try {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.info("[AUTH_DEBUG] server-logout", { render: "server" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
