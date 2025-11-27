import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { BookingForm } from "./_components/BookingForm";

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
        // Explicitly exclude OWNER role users
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

export const dynamic = 'force-dynamic';

export default async function BookingPage() {
  const defaultBarberId = await getDefaultBarberId();

  return (
    <Suspense fallback={null}>
      <BookingForm defaultBarberId={defaultBarberId} />
    </Suspense>
  );
}
