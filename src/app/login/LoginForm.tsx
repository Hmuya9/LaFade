"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || searchParams.get("redirectTo") || "/post-login";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "password") {
        const res = await signIn("credentials", {
          email: email.trim().toLowerCase(),
          password,
          redirect: false,
          callbackUrl,
        });

        if (res?.error) {
          setError("Invalid email or password");
        } else if (res?.ok) {
          // Redirect manually on success
          window.location.href = callbackUrl;
        }
      } else {
        const res = await signIn("email", {
          email: email.trim().toLowerCase(),
          callbackUrl,
        });

        if (res?.error) {
          setError("Failed to send magic link");
        } else {
          // NextAuth will redirect to verifyRequest page
          // Or we can redirect manually
          window.location.href = "/signin?checkEmail=1";
        }
      }
    } catch (err: any) {
      console.error("[LoginForm] Error:", err);
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="w-full rounded border border-zinc-300 px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      {mode === "password" && (
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="w-full rounded border border-zinc-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
      )}

      {error && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-zinc-900 px-4 py-2 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading 
          ? "Signing in..." 
          : mode === "password" 
            ? "Sign in" 
            : "Send magic link"}
      </button>

      <button
        type="button"
        className="mt-2 w-full text-sm text-zinc-600 hover:text-zinc-900 underline"
        onClick={() =>
          setMode((m) => (m === "password" ? "magic" : "password"))
        }
      >
        {mode === "password"
          ? "Use magic link instead"
          : "Use password instead"}
      </button>
    </form>
  );
}





