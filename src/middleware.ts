import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const hasSession = Boolean(req.cookies.get("sb-access-token")?.value || req.cookies.get("sb-tk")?.value);
  if (!hasSession) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
