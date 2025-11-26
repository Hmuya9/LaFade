"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect } from "react";
import { changePassword } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const initialState = {
  success: false,
  message: "",
  fieldErrors: {} as Record<string, string[]>,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending} aria-disabled={pending}>
      {pending ? "Updating..." : "Update password"}
    </Button>
  );
}

export interface ChangePasswordFormProps {
  onSuccess?: () => void;
}

export function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps) {
  const [state, formAction] = useFormState(changePassword, initialState);

  // Close modal on success
  useEffect(() => {
    if (state.success && onSuccess) {
      // Small delay to show success message
      const timer = setTimeout(() => {
        onSuccess();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.success, onSuccess]);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
          {state.message && (
            <div
              className={`p-3 rounded text-sm ${
                state.success
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {state.success ? "✓ " : "✗ "}
              {state.message}
            </div>
          )}

          <div>
            <Label htmlFor="currentPassword" className="mb-2 block">
              Current password
            </Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              placeholder="Enter your current password"
              autoComplete="current-password"
            />
            {state.fieldErrors?.currentPassword && (
              <p className="text-sm text-red-600 mt-1">
                {state.fieldErrors.currentPassword[0]}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="newPassword" className="mb-2 block">
              New password
            </Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
            {state.fieldErrors?.newPassword && (
              <p className="text-sm text-red-600 mt-1">
                {state.fieldErrors.newPassword[0]}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="mb-2 block">
              Confirm new password
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              placeholder="Confirm your new password"
              autoComplete="new-password"
            />
            {state.fieldErrors?.confirmPassword && (
              <p className="text-sm text-red-600 mt-1">
                {state.fieldErrors.confirmPassword[0]}
              </p>
            )}
          </div>

        <SubmitButton />
      </form>
    </div>
  );
}


