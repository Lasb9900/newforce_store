import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function hasSupabaseSession(req: NextRequest) {
  const all = req.cookies.getAll();

  return all.some((cookie) => {
    if (cookie.name === "sb-access-token" || cookie.name === "sb-tk") return true;
    return cookie.name.startsWith("sb-") && cookie.name.includes("auth-token");
  });
}

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (!hasSupabaseSession(req)) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
