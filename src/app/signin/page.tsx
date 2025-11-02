import { signIn } from "@/lib/auth";

export default function SignInPage() {
  async function onSubmit(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "").trim();
    // NextAuth Email provider id is "email"
    await signIn("email", { email, redirectTo: "/post-login" });
  }

  return (
    <div className="max-w-lg mx-auto py-16">
      <h1 className="text-3xl font-bold mb-6">Sign in</h1>
      <form action={onSubmit} className="space-y-4">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="w-full rounded-md border px-3 py-2"
        />
        <button className="w-full rounded-md bg-black text-white py-2">
          Send Magic Link
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-3">
        We'll email you a secure one-time link to sign in.
      </p>
    </div>
  );
}

