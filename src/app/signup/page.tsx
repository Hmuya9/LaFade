"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/AuthCard";
import { UserPlus } from "lucide-react";
import { signupAction, type SignupActionState } from "./actions";

const initialState: SignupActionState = {
  ok: false,
  error: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account..." : "Sign up"}
    </Button>
  );
}

export default function SignupPage() {
  const [state, formAction] = useFormState(signupAction, initialState);

  return (
    <AuthCard
      icon={UserPlus}
      title="Create your LaFade account"
      subtitle="Sign up with your email and password"
      footer={
        <div className="space-y-2 text-sm text-zinc-600 w-full">
          {state.error && !state.error.includes("NEXT_REDIRECT") && (
            <p className="text-sm text-red-600">
              ✗ {state.error}
            </p>
          )}
          <p>
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:text-blue-800 underline">
              Sign in
            </Link>
          </p>
        </div>
      }
    >
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="name" className="mb-2 block">
            Name (optional)
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Your name"
            autoComplete="name"
          />
        </div>
        <div>
          <Label htmlFor="email" className="mb-2 block">
            Email *
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <div>
          <Label htmlFor="password" className="mb-2 block">
            Password *
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />
        </div>
        <SubmitButton />
      </form>
    </AuthCard>
  );
}

