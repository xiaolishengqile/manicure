import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  SITE_ACCESS_COOKIE_NAME,
  isSiteAccessEnabled,
  verifySiteAccessCookieValue,
} from "@/lib/site-access";

export async function middleware(request: NextRequest) {
  if (!isSiteAccessEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/site-access")
  ) {
    return NextResponse.next();
  }

  const raw = request.cookies.get(SITE_ACCESS_COOKIE_NAME)?.value;
  const ok = await verifySiteAccessCookieValue(raw);

  if (ok) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "需要登录：请先访问站点并在登录页输入访问口令" },
      { status: 401 },
    );
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("from", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
