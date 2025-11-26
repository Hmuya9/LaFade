"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <Button
      variant="outline"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="w-full rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200"
    >
      <LogOut className="w-4 h-4 mr-2" />
      Sign Out
    </Button>
  );
}



