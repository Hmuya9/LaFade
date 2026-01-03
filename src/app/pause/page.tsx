import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PausePageProps = {
  searchParams: Promise<{ bypass?: string }>;
};

export default async function PausePage(props: PausePageProps) {
  const searchParams = await props.searchParams;
  const bypassToken = searchParams.bypass;
  const PAUSE_BYPASS_TOKEN = process.env.PAUSE_BYPASS_TOKEN;
  const PAUSE_SITE = process.env.PAUSE_SITE === "true";

  // If site is not paused, redirect to home
  if (!PAUSE_SITE) {
    redirect("/");
  }

  // Check if bypass token is valid
  const isValidBypass = 
    PAUSE_BYPASS_TOKEN && 
    bypassToken === PAUSE_BYPASS_TOKEN;

  // If valid bypass token, set cookie (middleware will handle it, but we can show status)
  let bypassEnabled = false;
  if (isValidBypass) {
    const cookieStore = await cookies();
    const existingBypass = cookieStore.get("pause_bypass")?.value === "1";
    bypassEnabled = existingBypass || isValidBypass;
  } else {
    // Check if cookie already exists
    const cookieStore = await cookies();
    bypassEnabled = cookieStore.get("pause_bypass")?.value === "1";
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-6">
      <div className="max-w-2xl mx-auto text-center">
        {/* Bypass Status Banner */}
        {bypassEnabled && (
          <div className="mb-8 p-4 bg-amber-500/20 border border-amber-500/50 rounded-lg">
            <p className="text-amber-700 dark:text-amber-300 font-medium">
              ✓ Bypass enabled - You can access the full site
            </p>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-xl p-12 border border-zinc-200">
          <h1 className="text-5xl font-bold text-zinc-900 mb-6 tracking-tight">
            {BRAND}
          </h1>
          
          <h2 className="text-3xl font-semibold text-zinc-800 mb-4">
            We&apos;re Temporarily Paused
          </h2>
          
          <p className="text-lg text-zinc-600 mb-8 leading-relaxed max-w-xl mx-auto">
            We&apos;re taking a brief pause to improve our service and prepare something special for you. 
            We&apos;ll be back soon with an even better experience.
          </p>

          <div className="space-y-4">
            <Button
              asChild
              size="lg"
              className="bg-amber-500 text-zinc-900 hover:bg-amber-400 font-semibold px-8 py-6 text-lg"
            >
              <Link href="#waitlist">
                Join Waitlist
              </Link>
            </Button>
            
            <p className="text-sm text-zinc-500 mt-6">
              Be the first to know when we&apos;re back
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <p className="mt-12 text-sm text-zinc-400">
          Thank you for your patience and understanding.
        </p>
      </div>
    </main>
  );
}

