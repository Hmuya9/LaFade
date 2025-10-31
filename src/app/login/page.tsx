import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { checkEmail?: string };
}) {
  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "").trim();
    if (!email) return;

    try {
      await signIn("email", {
        email,
        redirectTo: "/post-login",
      });
    } catch (err) {
      console.error("Sign-in error:", err);
      // Redirect to same page with error param
      redirect("/login?error=send_failed");
    }

    // Success - redirect to show "check your email" message
    redirect("/login?checkEmail=1");
  }

  return (
    <div className="mx-auto max-w-md py-12 px-4">
      <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
      <p className="text-sm text-gray-600 mb-6">
        We'll email you a magic link to sign in.
      </p>

      {searchParams?.checkEmail && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
          ✓ Check your inbox for the sign-in link
        </div>
      )}

      <form action={action} className="space-y-4">
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button
          type="submit"
          className="w-full rounded bg-black p-3 text-white hover:bg-gray-800"
        >
          Send Magic Link
        </button>
      </form>
    </div>
  );
}
