import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const AUTH_SECRET = process.env.NEXTAUTH_SECRET;

const publicRoutes = [
  "/",
  "/plans",
  "/login",
  "/signup",
  "/signin",
  "/client/login",
  "/barber/login",
  "/forgot-password",
  "/reset-password",
  "/post-login", // Allow post-login to handle its own redirects
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Ignore static & API
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: AUTH_SECRET });
  const role = (token as any)?.role as "CLIENT" | "BARBER" | "OWNER" | undefined;

  const isPublic = publicRoutes.includes(pathname);
  const isAuthRoute = 
    pathname.startsWith("/login") || 
    pathname.startsWith("/signup") || 
    pathname.startsWith("/signin") ||
    pathname.startsWith("/client/login") ||
    pathname.startsWith("/barber/login");

  // Not logged in: block protected pages
  if (!token && !isPublic && !isAuthRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Logged in: redirect auth routes to post-login
  // BUT: Only if we have a valid token AND it's not already going to post-login
  if (token && isAuthRoute && pathname !== "/post-login") {
    const url = req.nextUrl.clone();
    url.pathname = "/post-login";
    return NextResponse.redirect(url);
  }

  // Role-based access control
  if (pathname.startsWith("/admin")) {
    if (role !== "OWNER") {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/barber")) {
    if (role !== "BARBER" && role !== "OWNER") {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};

