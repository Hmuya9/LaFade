import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Get the correct dashboard route for a given role
 * This matches the logic in lib/auth.ts but is available in middleware
 */
function getDashboardRouteForRole(role: "CLIENT" | "BARBER" | "OWNER" | undefined): string {
  if (!role) return "/login";
  
  switch (role) {
    case "CLIENT":
      return "/account";
    case "BARBER":
      return "/barber";
    case "OWNER":
      return "/barber"; // OWNER uses barber dashboard (admin is separate)
    default:
      return "/login";
  }
}

const AUTH_SECRET = process.env.NEXTAUTH_SECRET;

// Guard: Ensure NEXTAUTH_SECRET is set (required for middleware)
// In production, fail fast with clear error
if (!AUTH_SECRET && process.env.NODE_ENV === "production") {
  throw new Error(
    "NEXTAUTH_SECRET is required in production. Please set the NEXTAUTH_SECRET environment variable."
  );
}
if (!AUTH_SECRET && process.env.NODE_ENV !== "test" && process.env.NODE_ENV !== "production") {
  console.error("[middleware] NEXTAUTH_SECRET is not set. Middleware may not work correctly.");
}

const publicRoutes = [
  "/",
  "/plans",
  "/booking",
  "/onboarding",
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

  // PAUSE SITE LOGIC - Check first, before any other logic
  const PAUSE_SITE = process.env.PAUSE_SITE === "true";
  const PAUSE_BYPASS_TOKEN = process.env.PAUSE_BYPASS_TOKEN;

  if (PAUSE_SITE) {
    // Check for bypass: query param or cookie
    const bypassQuery = req.nextUrl.searchParams.get("bypass");
    const bypassCookie = req.cookies.get("pause_bypass")?.value === "1";
    const hasBypass = 
      (PAUSE_BYPASS_TOKEN && bypassQuery === PAUSE_BYPASS_TOKEN) || 
      bypassCookie;

    // Always allow these paths (even when paused)
    const allowedPaths = [
      "/pause",
      "/api",
      "/_next",
      "/favicon.ico",
      "/robots.txt",
      "/sitemap.xml",
    ];

    const isAllowedPath = allowedPaths.some((path) => 
      pathname === path || pathname.startsWith(path)
    );

    // If bypass is active OR path is allowed, let through
    if (hasBypass || isAllowedPath) {
      // If bypass token is in query, set cookie for future requests
      if (PAUSE_BYPASS_TOKEN && bypassQuery === PAUSE_BYPASS_TOKEN) {
        const response = NextResponse.next();
        response.cookies.set("pause_bypass", "1", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
        return response;
      }
      return NextResponse.next();
    }

    // Everything else: redirect to /pause (307 = temporary redirect, preserves method)
    const url = req.nextUrl.clone();
    url.pathname = "/pause";
    return NextResponse.redirect(url, 307);
  }

  // Ignore static & API (original logic continues when not paused)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // If NEXTAUTH_SECRET is missing, skip auth checks (development only)
  let token = null;
  let role: "CLIENT" | "BARBER" | "OWNER" | undefined = undefined;
  
  if (AUTH_SECRET) {
    try {
      token = await getToken({ req, secret: AUTH_SECRET });
      role = (token as any)?.role as "CLIENT" | "BARBER" | "OWNER" | undefined;
    } catch (error) {
      console.error("[middleware] Error getting token:", error);
      // Continue without token if there's an error
    }
  }

  const isPublic = publicRoutes.includes(pathname);
  const isAuthRoute = 
    pathname.startsWith("/login") || 
    pathname.startsWith("/signup") || 
    pathname.startsWith("/signin") ||
    pathname.startsWith("/client/login") ||
    pathname.startsWith("/barber/login");

  // Early return for public routes - no auth checks, no redirects
  // This is critical for / to work correctly in all browsers
  if (isPublic) {
    return NextResponse.next();
  }

  // Not logged in: block protected pages
  if (!token && !isAuthRoute) {
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

  // Role-based access control with correct dashboard redirects
  if (pathname.startsWith("/admin")) {
    if (role !== "OWNER") {
      const url = req.nextUrl.clone();
      // Redirect to correct dashboard for their role
      url.pathname = getDashboardRouteForRole(role);
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/barber")) {
    if (role !== "BARBER" && role !== "OWNER") {
      const url = req.nextUrl.clone();
      // Redirect to correct dashboard for their role
      url.pathname = getDashboardRouteForRole(role);
      return NextResponse.redirect(url);
    }
  }

  // Guard /account route: only CLIENT can access
  if (pathname === "/account" || pathname.startsWith("/account/")) {
    if (role !== "CLIENT") {
      const url = req.nextUrl.clone();
      // Redirect to correct dashboard for their role (not just /barber)
      url.pathname = getDashboardRouteForRole(role);
      return NextResponse.redirect(url);
    }
  }

  // Onboarding is gated at the page level (booking/page.tsx, account/page.tsx)
  // No middleware guard needed

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - api (API routes)
     * - favicon.ico, robots.txt, sitemap.xml (static assets)
     */
    "/((?!_next/static|_next/image|api/|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};

