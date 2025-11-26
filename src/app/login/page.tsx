import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { LogIn } from "lucide-react";
import { LoginForm } from "./LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; registered?: string };
}) {
  const successMessage = searchParams?.registered
    ? "Account created successfully! Please sign in."
    : null;

  return (
    <AuthCard
      icon={LogIn}
      title="Sign in to LaFade"
      subtitle="Use your email and password to access your account"
      footer={
        <div className="space-y-2 text-sm text-zinc-600 w-full">
          {successMessage && (
            <p className="text-sm text-emerald-600 font-medium">
              ✓ {successMessage}
            </p>
          )}
          <p>
            New to LaFade?{" "}
            <Link href="/signup" className="text-blue-600 hover:text-blue-800 underline">
              Create an account
            </Link>
          </p>
        </div>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
