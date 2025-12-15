import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PlansClient } from "./_components/PlansClient";
// Business rules source of truth
import { COPY, ONE_FREE_CUT_PER_USER, SECOND_CUT_PRICE_CENTS, MEMBERSHIP_STANDARD_PRICE_CENTS } from "@/lib/lafadeBusiness";

export const dynamic = 'force-dynamic';

export default async function PlansPage() {
  // Query database for TRIAL_FREE appointments (DB-backed truth)
  let hasUsedTrial = false;

  const session = await auth();
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (user) {
      // Check for any non-canceled TRIAL_FREE appointment
      const trialAppointment = await prisma.appointment.findFirst({
        where: {
          clientId: user.id,
          kind: "TRIAL_FREE",
          status: { not: "CANCELED" },
        },
      });

      hasUsedTrial = !!trialAppointment;
    }
  }

  return <PlansClient hasUsedTrial={hasUsedTrial} />;
}