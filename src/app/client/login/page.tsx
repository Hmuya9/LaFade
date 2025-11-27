import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Mail } from "lucide-react";
import { ClientLoginForm } from "./ClientLoginForm";

export default function ClientLoginPage() {
  return (
    <AuthCard
      icon={Mail}
      title="Sign in for booking"
      subtitle="Use your email and password to book your cut"
      footer={
        <div className="space-y-2 text-sm text-zinc-600 w-full">
          <p>
            New to LaFade?{" "}
            <Link href="/signup" className="text-blue-600 hover:text-blue-800 underline">
              Create an account
            </Link>
          </p>
        </div>
      }
    >
      <ClientLoginForm />
    </AuthCard>
  );
}



