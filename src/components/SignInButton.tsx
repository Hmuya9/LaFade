"use client"

import { signIn, signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function SignInButton() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <Button disabled>Loading...</Button>
  }

  if (session) {
    // Prefer name over email, fallback to email if name is missing
    const displayName =
      session.user?.name && session.user.name.trim().length > 0
        ? session.user.name
        : session.user?.email;

    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-600">
          {displayName}
        </span>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => signOut()}
        >
          Sign Out
        </Button>
      </div>
    )
  }

  return (
    <Button 
      onClick={() => window.location.href = "/client/login"}
      size="sm"
    >
      Sign In
    </Button>
  )
}
