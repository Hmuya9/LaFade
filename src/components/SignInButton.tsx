"use client"

import { signIn, signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function SignInButton() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <Button disabled>Loading...</Button>
  }

  if (session) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-600">
          {session.user?.email}
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
