import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

const BARBER_EMAIL = (process.env.BARBER_EMAIL || "").trim().toLowerCase();

export default function BarberLoginPage({
  searchParams,
}: {
  searchParams?: { error?: string; checkEmail?: string };
}) {
  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "").trim().toLowerCase();
    if (!email) return;

    // Only allow the configured barber email
    if (!BARBER_EMAIL || email !== BARBER_EMAIL) {
      redirect("/barber/login?error=not_allowed");
    }

    try {
      await signIn("email", { email, redirectTo: "/barber" });
      redirect("/barber/login?checkEmail=1");
    } catch (err) {
      console.error("Sign-in error:", err);
      redirect("/barber/login?error=send_failed");
    }
  }

  return (
    <div className="mx-auto max-w-md py-12 px-4">
      <h1 className="text-2xl font-semibold mb-2">Barber Login</h1>
      <p className="text-sm text-gray-600 mb-6">
        We'll email you a magic link. Only the configured barber can sign in here.
      </p>

      {searchParams?.error === "not_allowed" && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          This email is not authorized for barber access.
        </div>
      )}

      {searchParams?.error === "send_failed" && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          Failed to send email. Please try again.
        </div>
      )}

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
          placeholder={process.env.BARBER_EMAIL || "barber@example.com"}
          defaultValue={process.env.BARBER_EMAIL}
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
