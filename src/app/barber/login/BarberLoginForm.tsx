"use client";

import { useState, FormEvent, useEffect } from "react";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function BarberLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [barberEmail, setBarberEmail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch barber email from server (for pre-filling, but not required)
  useEffect(() => {
    fetch("/api/barber/email")
      .then((res) => res.json())
      .then((data) => {
        if (data.barberEmail) {
          setBarberEmail(data.barberEmail.trim().toLowerCase());
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
      const res = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
        callbackUrl: "/barber",
      });

      if (res?.error) {
        setError("Invalid email or password");
      } else if (res?.ok) {
        // Redirect manually on success
        window.location.href = "/barber";
      }
    } catch (err: any) {
      console.error("[BarberLoginForm] Error:", err);
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
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

      <div>
        <Label htmlFor="password" className="mb-2 block">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          className="w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
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
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}


