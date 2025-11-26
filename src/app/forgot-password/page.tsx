"use client";

import { useFormState, useFormStatus } from "react-dom";
import { forgotPasswordAction } from "./actions";
import { AuthCard } from "@/components/auth/AuthCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import Link from "next/link";

const initialState = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending} aria-disabled={pending}>
      {pending ? "Sending..." : "Send reset link"}
    </Button>
  );
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState(forgotPasswordAction, initialState);

  return (
    <AuthCard
      icon={Mail}
      title="Forgot password"
      subtitle="Enter your email and we'll send you a link to reset your password."
      footer={
        <div className="space-y-2 text-sm text-zinc-600 w-full">
          {state?.message && (
            <p
              className={`text-sm ${
                state.status === "error" ? "text-red-600" : "text-green-600"
              }`}
            >
              {state.status === "success" ? "✓ " : "✗ "}
              {state.message}
            </p>
          )}
          <p>
            <Link href="/login" className="text-blue-600 hover:text-blue-800 underline">
              Back to login
            </Link>
          </p>
        </div>
      }
    >
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="email" className="mb-2 block">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
        <SubmitButton />
      </form>
    </AuthCard>
  );
}


