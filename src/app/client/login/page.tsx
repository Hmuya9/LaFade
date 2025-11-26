import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Mail } from "lucide-react";
import { ClientLoginForm } from "./ClientLoginForm";

export default function ClientLoginPage() {
  return (
    <AuthCard
      icon={Mail}
      title="Sign in for booking"
      subtitle="Receive a one-time sign-in link to book your cut"
      footer={
        <div className="space-y-2 text-sm text-zinc-600 w-full">
          <p>
            Prefer password login?{" "}
            <Link href="/login" className="text-blue-600 hover:text-blue-800 underline">
              Sign in with password
            </Link>
          </p>
        </div>
      }
    >
      <ClientLoginForm />
    </AuthCard>
  );
}



