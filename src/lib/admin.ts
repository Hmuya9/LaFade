import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Check if a role is the admin role (OWNER)
 */
function isAdminRole(role?: string | null): boolean {
  return role === "OWNER";
}

/**
 * Require that the current session user has the OWNER role (admin).
 * Redirects to /login if not authenticated or not an admin.
 */
export async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || !isAdminRole(role)) {
    redirect("/login");
  }
  return session;
}
