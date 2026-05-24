import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const hasSessionCookie =
    cookieHeader.includes("better-auth.session_token") ||
    cookieHeader.includes("__Secure-better-auth.session_token");

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// API routes handle their own auth via requireUser() and return 401 JSON.
// Excluding /api from the matcher lets fetch() get a clean 401 instead of a
// 307 redirect (which the client cannot interpret).
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
