import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SecuritySection } from "./_components/SecuritySection";
import { AppointmentsSkeleton } from "./_components/AppointmentsSkeleton";
import { UpcomingAppointmentsClient } from "./_components/UpcomingAppointmentsClient";
import { NextAppointmentCard } from "./_components/NextAppointmentCard";
import { LogoutButton } from "./_components/LogoutButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentList } from "@/components/ui/appointment-list";
import type { AppointmentCardData } from "@/components/ui/appointment-card";
import { DismissibleBanner } from "@/components/ui/dismissible-banner";

type AccountPageProps = {
  searchParams: { justBooked?: string; rescheduled?: string };
};

/**
 * Account Dashboard Page
 * 
 * Database assumptions:
 * - Single SQLite file at web/prisma/dev.db
 * - DATABASE_URL="file:./prisma/dev.db"
 * 
 * User lookup:
 * - Resolves user by email from session (same as booking API)
 * - Queries appointments by clientId (user.id)
 * 
 * Appointment filtering:
 * - Upcoming: status is BOOKED or CONFIRMED (status-based, no timezone issues)
 * - Past: status is CANCELED, COMPLETED, or NO_SHOW
 */
export default async function AccountPage({ searchParams }: AccountPageProps) {
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    // User exists in session but not in database - redirect to login to re-authenticate
    console.error('[account] User not found in database', { email: session.user.email });
    redirect('/login');
  }
  const justBooked = searchParams?.justBooked === "1";
  const rescheduled = searchParams?.rescheduled === "1";
  
  // Redirect non-CLIENT users
  if (user) {
    const role = user.role;
    if (role === "BARBER" || role === "OWNER") {
      if (role === "BARBER") {
        redirect("/barber");
      } else {
        redirect("/admin/appointments");
      }
    }
  }
  
  const agg = user ? await prisma.pointsLedger.aggregate({ 
    where: { userId: user.id }, 
    _sum: { delta: true }
  }) : { _sum: { delta: 0 }};
  
  const points = agg._sum.delta ?? 0;
  const hasPassword = Boolean(user?.passwordHash);

  // Fetch appointments by clientId (simple, direct query)
  const allAppointments = await prisma.appointment.findMany({
    where: { clientId: user.id },
    include: {
      barber: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          city: true,
          photos: {
            where: { isApproved: true },
            select: { url: true },
            take: 1,
            orderBy: { createdAt: "desc" }
          }
        }
      }
    },
    orderBy: { startAt: 'asc' },
  });

  // SIMPLE DEBUG - log what we actually got
  console.log('[account][SIMPLE]', {
    userId: user.id,
    totalFound: allAppointments.length,
    appointments: allAppointments.map(a => ({
      id: a.id.substring(0, 8),
      status: a.status,
      clientId: a.clientId.substring(0, 8),
    })),
  });

  // Status-based filtering (avoids timezone issues)
  // Upcoming: anything still active (BOOKED or CONFIRMED)
  const upcomingRaw = allAppointments.filter(
    (a) => a.status === 'BOOKED' || a.status === 'CONFIRMED'
  );
  
  // Past: everything else (CANCELED, COMPLETED, NO_SHOW)
  const pastRaw = allAppointments.filter(
    (a) => a.status === 'CANCELED' || 
           a.status === 'COMPLETED' || 
           a.status === 'NO_SHOW'
  );

  // Format appointments
  const formatAppointment = (apt: typeof allAppointments[0]): AppointmentCardData => {
    let planName = "Standard";
    if (apt.isFree) {
      planName = "Free Test Cut";
    } else if (apt.type === "HOME") {
      planName = "Deluxe";
    }

    const barberPhoto = apt.barber.photos?.[0]?.url || apt.barber.image || null;

    return {
      id: apt.id,
      barber: {
        id: apt.barber.id,
        name: apt.barber.name || apt.barber.email || "Barber",
        photo: barberPhoto,
        city: apt.barber.city || null,
      },
      plan: planName,
      startAt: apt.startAt.toISOString(),
      endAt: apt.endAt.toISOString(),
      status: apt.status as AppointmentCardData["status"],
      type: apt.type,
      address: apt.address,
      notes: apt.notes
    };
  };

  const upcoming = upcomingRaw.map(formatAppointment);
  const past = pastRaw.map(formatAppointment).reverse();

  // Debug logging to see what's actually happening
  console.log('[account][DEBUG]', {
    userId: user.id,
    userEmail: user.email,
    totalAppointments: allAppointments.length,
    upcomingCount: upcoming.length,
    pastCount: past.length,
    allAppointmentIds: allAppointments.map(a => ({ id: a.id, clientId: a.clientId, status: a.status, startAt: a.startAt.toISOString() })),
  });

  const userName = session.user?.name || session.user?.email?.split("@")[0] || "there";

  // DEBUG PANEL (dev only)
  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-3xl mx-auto py-8 md:py-16 px-4 space-y-4 md:space-y-6 pb-24 md:pb-16">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-1">
          Welcome back, {userName}!
        </h1>
        <p className="text-slate-600">
          Here&apos;s your dashboard.
        </p>
      </div>

      {/* Booking Success Banner */}
      {justBooked && (
        <DismissibleBanner variant="success" autoDismiss duration={4500}>
          <span className="font-semibold">Your cut is booked ✂️</span> — you&apos;ll find it below in Your Upcoming Appointments.
        </DismissibleBanner>
      )}

      {/* Reschedule Success Banner */}
      {rescheduled && (
        <DismissibleBanner variant="success" autoDismiss duration={4500}>
          <span className="font-semibold">Appointment rescheduled successfully ✂️</span> — your new appointment is below.
        </DismissibleBanner>
      )}

      {/* Next Appointment Card - Only show if there's an upcoming appointment */}
      {upcoming.length > 0 && (
        <NextAppointmentCard nextAppointment={upcoming[0]} />
      )}

      {/* My Appointments Section */}
      <div id="appointments">
        <Card className="rounded-2xl shadow-sm border-slate-200/60 bg-white">
          <CardHeader className="bg-gradient-to-br from-slate-50 to-rose-50/40 rounded-t-2xl border-b">
            <CardTitle className="text-2xl font-semibold text-slate-900">My Appointments</CardTitle>
            <CardDescription className="text-slate-600">View and manage your upcoming cuts</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <UpcomingAppointmentsClient appointments={upcoming} />
          </CardContent>
        </Card>
      </div>
      
      {/* Past Appointments Section */}
      {past.length > 0 && (
        <Card className="rounded-2xl shadow-sm border-slate-200/60 bg-white">
          <CardHeader className="bg-gradient-to-br from-slate-50 to-rose-50/40 rounded-t-2xl border-b">
            <CardTitle className="text-2xl font-semibold text-slate-900">Past Appointments</CardTitle>
            <CardDescription className="text-slate-600">Your booking history</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <AppointmentList appointments={past} />
          </CardContent>
        </Card>
      )}

      {/* Points Section */}
      <Card className="rounded-2xl shadow-sm border-slate-200/60 bg-white">
        <CardHeader className="bg-gradient-to-br from-slate-50 to-amber-50/40 rounded-t-2xl border-b">
          <CardTitle className="text-2xl font-semibold text-slate-900">Points Balance</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-4xl font-bold bg-gradient-to-r from-rose-600 to-amber-600 bg-clip-text text-transparent">
            {points}
          </div>
          <p className="text-sm text-slate-600 mt-2">Available for booking</p>
        </CardContent>
      </Card>

      {/* Subscription Section */}
      <Card className="rounded-2xl shadow-sm border-slate-200/60 bg-white">
        <CardHeader className="bg-gradient-to-br from-slate-50 to-rose-50/40 rounded-t-2xl border-b">
          <CardTitle className="text-2xl font-semibold text-slate-900">Subscription</CardTitle>
          <CardDescription className="text-slate-600">Manage your subscription and billing</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
            <p className="font-semibold mb-1">Memberships are coming soon.</p>
            <p>
              We&apos;re putting the finishing touches on payment processing. To subscribe or manage a membership today,
              text or call LaFade customer support at{" "}
              <span className="font-semibold">(+1) 425-524-2909</span>. We respond fast.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <SecuritySection hasPassword={hasPassword} />

      {/* Logout Section */}
      <div className="pt-4">
        <LogoutButton />
      </div>
      </div>
    </main>
  );
}
