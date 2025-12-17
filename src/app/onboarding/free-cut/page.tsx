import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getClientFunnelForUser } from "@/lib/client-funnel";
import { FreeCutOnboardingClient } from "./FreeCutOnboardingClient";

export const dynamic = "force-dynamic";

export default async function FreeCutOnboardingPage() {
  // Onboarding page is public - no server-side redirects
  // Auth checks and redirects happen client-side in FreeCutOnboardingClient
  // This prevents Safari redirect loops
  const session = await auth();
  const user = session?.user?.email
    ? await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          id: true,
          role: true,
          hasAnsweredFreeCutQuestion: true,
        },
      })
    : null;

  const funnel = user ? await getClientFunnelForUser(user.id) : null;

  return <FreeCutOnboardingClient />;
}


