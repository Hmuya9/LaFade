"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { SetPasswordForm } from "./SetPasswordForm";

export interface SecuritySectionProps {
  hasPassword: boolean;
}

export function SecuritySection({ hasPassword }: SecuritySectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const modalTitle = hasPassword ? "Change Password" : "Set Password";
  const modalDescription = hasPassword
    ? "Update your password to keep your account secure."
    : "You currently use email magic links. Set a password to also sign in on /login.";

  return (
    <>
      <Card className="rounded-2xl shadow-sm border-slate-200/60 bg-white">
        <CardHeader className="bg-gradient-to-br from-slate-50 to-rose-50/40 rounded-t-2xl border-b">
          <CardTitle className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Lock className="w-5 h-5 text-rose-500" />
            Security
          </CardTitle>
          <CardDescription className="text-slate-600">
            Manage your account security settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="outline"
            className="w-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 transition-all duration-200"
          >
            Manage password & security
          </Button>
        </CardContent>
      </Card>

      <SimpleModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
        description={modalDescription}
      >
        {hasPassword ? (
          <ChangePasswordForm onSuccess={() => setIsModalOpen(false)} />
        ) : (
          <SetPasswordForm onSuccess={() => setIsModalOpen(false)} />
        )}
      </SimpleModal>
    </>
  );
}



