import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Mail } from "lucide-react";
import { MagicLinkForm } from "./MagicLinkForm";

export default function SignInPage() {
  return (
    <AuthCard
      icon={Mail}
      title="Sign in with a magic link"
      subtitle="We'll email you a one-time sign-in link"
      footer={
        <div className="space-y-2 text-sm text-zinc-600 w-full">
          <p>
            Prefer password login?{" "}
            <Link href="/login" className="text-blue-600 hover:text-blue-800 underline">
              Use email & password
            </Link>
          </p>
        </div>
      }
    >
      <MagicLinkForm />
    </AuthCard>
  );
}


