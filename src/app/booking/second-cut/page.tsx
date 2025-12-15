import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getClientFunnelForUser } from "@/lib/client-funnel";
import { BookingForm } from "../_components/BookingForm";
import { PRICING, formatPrice } from "@/lib/pricing";

async function getDefaultBarberId(): Promise<string | undefined> {
  const barberEmail = env.BARBER_EMAIL?.toLowerCase() ?? null;

  let defaultBarberId: string | null = null;

  if (barberEmail) {
    const barberByEmail = await prisma.user.findFirst({
      where: {
        email: barberEmail,
        role: "BARBER",
      },
      select: { id: true },
    });

    if (barberByEmail) {
      defaultBarberId = barberByEmail.id;
    }
  }

  // Fallback: first BARBER user if BARBER_EMAIL not set or lookup fails (exclude OWNER)
  if (!defaultBarberId) {
    const barberByRole = await prisma.user.findFirst({
      where: {
        role: "BARBER",
        NOT: { role: "OWNER" },
      },
      select: { id: true },
    });

    if (barberByRole) {
      defaultBarberId = barberByRole.id;
    }
  }

  return defaultBarberId ?? undefined;
}

export const dynamic = "force-dynamic";

export default async function SecondCutBookingPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "CLIENT") {
    if (user.role === "BARBER") {
      redirect("/barber");
    }
    redirect("/admin/appointments");
  }

  const funnel = await getClientFunnelForUser(user.id);

  // Only clients in the second-cut window should be here
  if (funnel.stage !== "SECOND_WINDOW") {
    redirect("/account");
  }

  const defaultBarberId = await getDefaultBarberId();

  const secondWindowExpiresAt = funnel.secondWindowExpiresAt;

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-4xl mx-auto py-8 md:py-12 px-4 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">
            You unlocked your {PRICING.secondCut10.label}!
          </h1>
          {secondWindowExpiresAt && (
            <p className="text-slate-600">
              Book before{" "}
              <span className="font-semibold">
                {secondWindowExpiresAt.toLocaleDateString()}
              </span>{" "}
              to use your discounted second cut.
            </p>
          )}
        </div>
        <Suspense fallback={null}>
          {/* Reuse existing booking form; pricing logic will be enforced server-side */}
          <BookingForm defaultBarberId={defaultBarberId} isSecondCut />
        </Suspense>
      </div>
    </main>
  );
}


