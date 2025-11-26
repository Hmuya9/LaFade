"use client";

import { useState, FormEvent, useEffect } from "react";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function BarberLoginForm() {
  const [email, setEmail] = useState("");
  const [barberEmail, setBarberEmail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Fetch barber email from server
  useEffect(() => {
    fetch("/api/barber/email")
      .then((res) => res.json())
      .then((data) => {
        if (data.barberEmail) {
          setBarberEmail(data.barberEmail.trim().toLowerCase());
          setEmail(data.barberEmail.trim().toLowerCase());
        }
      })
      .catch((err) => {
        console.error("Failed to fetch barber email:", err);
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    // Only allow the configured barber email if it's set
    if (barberEmail && normalizedEmail !== barberEmail) {
      setError("Only authorized barbers can sign in here.");
      setLoading(false);
      return;
    }

    try {
      const res = await signIn("email", {
        email: normalizedEmail,
        callbackUrl: "/barber",
      });

      if (res?.error) {
        setError("Failed to send email. Please try again.");
      } else {
        setSent(true);
      }
    } catch (err: any) {
      console.error("[BarberLoginForm] Error:", err);
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
          ✓ Magic link sent! Check your email.
        </div>
        <p className="text-sm text-zinc-600">
          We've sent a sign-in link to <strong>{email}</strong>
        </p>
        <p className="text-sm text-zinc-500">
          Click the link in the email to access the barber dashboard.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email" className="mb-2 block">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          className="w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder={barberEmail || "barber@example.com"}
          autoComplete="email"
        />
      </div>

      {error && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full"
      >
        {loading ? "Sending..." : "Send Magic Link"}
      </Button>
    </form>
  );
}


