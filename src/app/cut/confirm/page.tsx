import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CutConfirmClient } from "./CutConfirmClient";

type CutConfirmPageProps = {
  searchParams: {
    appt?: string;
    b?: string;
  };
};

export const dynamic = "force-dynamic";

export default async function CutConfirmPage({ searchParams }: CutConfirmPageProps) {
  const { appt, b } = searchParams;

  if (!appt || !b) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold text-slate-900">Invalid confirmation link</h1>
          <p className="text-sm text-slate-600">
            This confirmation link is missing information. Please ask your barber to re-send the QR code.
          </p>
        </div>
      </main>
    );
  }

  const session = await auth();

  // If not logged in, send to login and come back here after
  if (!session?.user?.email) {
    const callbackUrl = encodeURIComponent(`/cut/confirm?appt=${appt}&b=${b}`);
    redirect(`/login?callbackUrl=${callbackUrl}`);
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    const callbackUrl = encodeURIComponent(`/cut/confirm?appt=${appt}&b=${b}`);
    redirect(`/login?callbackUrl=${callbackUrl}`);
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appt },
    select: {
      id: true,
      barberId: true,
      clientId: true,
      status: true,
      barber: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!appointment) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold text-slate-900">Appointment not found</h1>
          <p className="text-sm text-slate-600">
            We couldn&apos;t find a matching appointment for this QR code. Please confirm with your barber.
          </p>
        </div>
      </main>
    );
  }

  // Verify: appointment.clientId === currentUser.id and appointment.barberId === b
  if (appointment.clientId !== user.id) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold text-slate-900">This cut is not linked to your account</h1>
          <p className="text-sm text-slate-600">
            Please make sure you&apos;re signed in with the same email you used to book this appointment.
          </p>
        </div>
      </main>
    );
  }

  if (appointment.barberId !== b) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold text-slate-900">Invalid QR code</h1>
          <p className="text-sm text-slate-600">
            This QR code doesn&apos;t match the barber for this appointment. Please ask your barber for a new QR code.
          </p>
        </div>
      </main>
    );
  }

  // Check if already completed or canceled
  if (appointment.status === "COMPLETED") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold text-slate-900">Already confirmed</h1>
          <p className="text-sm text-slate-600">
            This cut has already been confirmed. Thank you!
          </p>
        </div>
      </main>
    );
  }

  if (appointment.status === "CANCELED") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold text-slate-900">Appointment canceled</h1>
          <p className="text-sm text-slate-600">
            This appointment has been canceled and cannot be confirmed.
          </p>
        </div>
      </main>
    );
  }

  return <CutConfirmClient apptId={appointment.id} barberId={appointment.barberId} />;
}


