import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSupabase } from "@/lib/supabase";

function buildRedirectUrl(request: NextRequest) {
  const url = new URL("/login", request.url);
  url.searchParams.set("signedOut", "1");
  return url;
}

async function clearSupabaseCookies() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  for (const cookie of allCookies) {
    if (
      cookie.name.startsWith("sb-") ||
      cookie.name.includes("supabase") ||
      cookie.name.includes("auth-token")
    ) {
      try {
        cookieStore.set(cookie.name, "", {
          path: "/",
          expires: new Date(0),
        });
      } catch (error) {
        console.error("[AUTH_SIGNOUT][CLEAR_COOKIE_ERROR]", cookie.name, error);
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getServerSupabase();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[AUTH_SIGNOUT][SIGNOUT_ERROR]", error.message);
    } else {
      console.info("[AUTH_SIGNOUT][SIGNOUT_OK]");
    }
  } catch (error) {
    console.error("[AUTH_SIGNOUT][SIGNOUT_EXCEPTION]", error);
  }

  await clearSupabaseCookies();

  return NextResponse.redirect(buildRedirectUrl(request), 303);
}

export async function GET(request: NextRequest) {
  await clearSupabaseCookies();
  return NextResponse.redirect(buildRedirectUrl(request), 303);
}