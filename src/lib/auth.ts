// src/lib/auth.ts
import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";
import { redirect } from "next/navigation";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

// Backward compatibility: keep auth() as alias for getServerSession
export async function auth() {
  return getServerSession(authOptions);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

type Role = "CLIENT" | "BARBER" | "OWNER";

/**
 * Get the correct dashboard route for a given role
 * This is the single source of truth for role-based routing
 */
export function getDashboardRouteForRole(role: Role | undefined): string {
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

/**
 * Require user to have one of the specified roles, redirecting to correct dashboard if wrong role
 * This is the centralized role guard that ensures users always go to their correct dashboard
 */
export async function requireRoleWithRedirect(roles: Role[]) {
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect("/login");
  }

  // Get role from session (from JWT token)
  const role = (session.user as any)?.role as Role | undefined;

  if (!role || !roles.includes(role)) {
    // Redirect to correct dashboard for their role (not just /login)
    const correctDashboard = getDashboardRouteForRole(role);
    redirect(correctDashboard);
  }

  // Also verify role in database for extra security
  const { prisma } = await import("./db");
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true, email: true },
  });

  if (!user) {
    redirect("/login");
  }

  // Double-check database role matches session role
  if (user.role !== role) {
    console.warn("[auth] Role mismatch between session and database", {
      sessionRole: role,
      dbRole: user.role,
      email: session.user.email,
    });
    // Use database role as source of truth
    const correctDashboard = getDashboardRouteForRole(user.role);
    redirect(correctDashboard);
  }

  return {
    id: user.id,
    email: user.email!,
    role: user.role,
  };
}

/**
 * Legacy requireRole - kept for backward compatibility
 * Use requireRoleWithRedirect() for new code
 */
export async function requireRole(roles: Role[]) {
  const user = await getCurrentUser();
  const role = (user as any)?.role as Role | undefined;

  if (!user || !role || !roles.includes(role)) {
    redirect("/login");
  }

  return user as any as { id: string; email: string; role: Role };
}

// Re-export authOptions for convenience
export { authOptions };
