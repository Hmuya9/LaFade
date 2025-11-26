"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { resetPasswordAction } from "./actions";
import { AuthCard } from "@/components/auth/AuthCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";
import Link from "next/link";

const initialState = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending} aria-disabled={pending}>
      {pending ? "Updating..." : "Update password"}
    </Button>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [state, formAction] = useFormState(resetPasswordAction, initialState);

  if (!token) {
    return (
      <AuthCard
        icon={KeyRound}
        title="Reset password"
        subtitle="Invalid or missing reset token."
        footer={
          <p>
            <Link href="/forgot-password" className="text-blue-600 hover:text-blue-800 underline">
              Request a new reset link
            </Link>
          </p>
        }
      >
        <p className="text-sm text-red-600">
          This reset link is invalid. Please request a new password reset.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={KeyRound}
      title="Reset password"
      subtitle="Choose a new password for your LaFade account."
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
          {state?.status === "success" && (
            <p>
              <Link href="/login" className="text-blue-600 hover:text-blue-800 underline">
                Go to login
              </Link>
            </p>
          )}
          {state?.status !== "success" && (
            <p>
              <Link href="/login" className="text-blue-600 hover:text-blue-800 underline">
                Back to login
              </Link>
            </p>
          )}
        </div>
      }
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />

        <div>
          <Label htmlFor="password" className="mb-2 block">
            New password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="At least 6 characters"
            required
            autoComplete="new-password"
          />
        </div>

        <div>
          <Label htmlFor="confirmPassword" className="mb-2 block">
            Confirm new password
          </Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            required
            autoComplete="new-password"
          />
        </div>

        <SubmitButton />
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <AuthCard
        icon={KeyRound}
        title="Reset password"
        subtitle="Loading..."
      >
        <div className="text-center py-8">Loading...</div>
      </AuthCard>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}


