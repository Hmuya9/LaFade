"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * ONBOARDING FLOW TEST CHECKLIST:
 * 
 * 1. New CLIENT logs in → first visit to /booking or /account → redirected to /onboarding/free-cut
 * 
 * 2. Clicking NO:
 *    - API logs: answer=NO redirect=/booking
 *    - DB: hasAnsweredFreeCutQuestion = true
 *    - Browser navigates to /booking and does not go back to onboarding
 * 
 * 3. Clicking YES:
 *    - API logs: answer=YES redirect=/booking/second-cut
 *    - DB: hasAnsweredFreeCutQuestion = true
 *    - Appointment created with TRIAL_FREE, COMPLETED
 *    - Browser navigates to /booking/second-cut
 */

export function FreeCutOnboardingClient() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnswer(answer: "YES" | "NO") {
    setError(null);
    setIsPending(true);

    try {
      const res = await fetch("/api/onboarding/free-cut", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answer }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Please try again.");
        setIsPending(false);
        return;
      }

      const data = (await res.json()) as { redirect?: string };
      
      // Log in dev to see what we got back
      if (process.env.NODE_ENV === "development") {
        console.log("[onboarding/free-cut] API response:", data);
      }

      const redirectPath = data.redirect || "/account";
      
      // Use window.location.href for reliable navigation
      window.location.href = redirectPath;
    } catch (err) {
      console.error("[onboarding/free-cut] submit error", err);
      setError("Something went wrong. Please try again.");
      setIsPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg border-slate-200/70">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-slate-900">
            Quick question before we continue
          </CardTitle>
          <p className="mt-1 text-sm text-slate-600">
            Did you already get your free cut from your barber?
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            <Button
              variant="default"
              disabled={isPending}
              onClick={() => handleAnswer("YES")}
            >
              Yes, I already got it
            </Button>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => handleAnswer("NO")}
            >
              No, not yet
            </Button>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

