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
