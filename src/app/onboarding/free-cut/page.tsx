import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getClientFunnelForUser } from "@/lib/client-funnel";
import { FreeCutOnboardingClient } from "./FreeCutOnboardingClient";

export const dynamic = "force-dynamic";

export default async function FreeCutOnboardingPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      role: true,
      hasAnsweredFreeCutQuestion: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  // Only CLIENTs should ever see this
  if (user.role !== "CLIENT") {
    if (user.role === "BARBER") {
      redirect("/barber");
    }
    redirect("/admin/appointments");
  }

  if (user.hasAnsweredFreeCutQuestion) {
    redirect("/account");
  }

  const funnel = await getClientFunnelForUser(user.id);

  if (funnel.stage === "MEMBER") {
    redirect("/account");
  }

  return <FreeCutOnboardingClient />;
}


