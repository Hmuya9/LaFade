"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type CutConfirmClientProps = {
  apptId: string;
  barberId: string;
};

export function CutConfirmClient({ apptId, barberId }: CutConfirmClientProps) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(5);
  const [review, setReview] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/cut/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apptId,
          barberId,
          rating,
          review: review.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Could not confirm this cut. Please try again.");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/account");
      }, 2000);
    } catch (err) {
      console.error("[cut/confirm] submit error", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md shadow-lg border-slate-200/70">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-slate-900">
            Confirm your cut
          </CardTitle>
          <p className="mt-1 text-sm text-slate-600">
            Rate your experience and confirm that your cut is complete.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">How was your cut?</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`h-9 w-9 rounded-full border text-sm font-semibold ${
                    rating >= star
                      ? "bg-yellow-400 border-yellow-500 text-slate-900"
                      : "bg-white border-slate-300 text-slate-500"
                  }`}
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                >
                  {star}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">Any feedback?</p>
            <Textarea
              placeholder="Optional: share anything about your experience"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="text-sm text-emerald-600">
              Thanks! Your cut has been confirmed. Redirecting to your account...
            </p>
          )}

          <Button
            type="button"
            className="w-full"
            disabled={submitting || success}
            onClick={handleSubmit}
          >
            {submitting ? "Confirming..." : "Confirm cut completion"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}







