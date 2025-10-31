import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || role !== "ADMIN") {
    redirect("/login");
  }
  return session;
}
