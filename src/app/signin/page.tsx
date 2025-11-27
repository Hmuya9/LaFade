import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

/**
 * Legacy signin page - redirects to standard login
 * This route is kept for backward compatibility but redirects to /login
 */
export default function SignInPage() {
  redirect("/login");
}


