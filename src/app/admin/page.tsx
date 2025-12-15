import { requireRoleWithRedirect } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminDashboard() {
  // Require OWNER role (same guard as /admin/dashboard)
  await requireRoleWithRedirect(["OWNER"]);
  
  // Redirect to the single admin dashboard
  redirect("/admin/dashboard");
}

