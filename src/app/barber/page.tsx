import { redirect } from "next/navigation";
import { requireRoleWithRedirect } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BarberDashboardClient } from "./_components/BarberDashboardClient";

export const dynamic = 'force-dynamic';

/**
 * Barber Dashboard - Server Component
 * 
 * Requirements:
 * - Only accessible to BARBER and OWNER roles
 * - CLIENT users are redirected to /account
 * - Fetches upcoming appointments server-side
 * - Handles zero bookings gracefully
 */
export default async function BarberDashboard() {
  // Role guard: Only BARBER and OWNER can access
  const user = await requireRoleWithRedirect(["BARBER", "OWNER"]);

  // Fetch upcoming appointments
  // OWNER: all barbers' appointments (no barberId filter)
  // BARBER: only their own appointments (barberId === user.id)
  const now = new Date();
  const scope = user.role === "OWNER" ? "ALL" : "MINE";
  
  const upcomingAppointments = await prisma.appointment.findMany({
    where: {
      ...(user.role === "BARBER" ? { barberId: user.id } : {}), // Only filter by barberId for BARBER role
      startAt: {
        gte: now, // Only future appointments
      },
      status: {
        in: ["BOOKED", "CONFIRMED"], // Only active appointments
      },
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      barber: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
    orderBy: {
      startAt: "asc", // Earliest first
    },
    take: 50, // Limit to next 50 appointments
  });

  // Fetch completed history (last 60 days) - scoped to logged-in barber only
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  
  const completedHistory = await prisma.appointment.findMany({
    where: {
      barberId: user.id, // Always filter by logged-in barber (even for OWNER role)
      status: "COMPLETED",
      startAt: {
        gte: sixtyDaysAgo, // Last 60 days
        lte: now, // Only past appointments
      },
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      barber: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
    orderBy: {
      startAt: "desc", // Most recent first
    },
    take: 200, // Limit to 200 most recent
  });

  // Format appointments for client component
  const formattedAppointments = upcomingAppointments.map((apt) => ({
    id: apt.id,
    client: {
      id: apt.client.id,
      name: apt.client.name || apt.client.email || "Client",
      email: apt.client.email || "",
      phone: apt.client.phone || "",
    },
    barber: {
      id: apt.barber?.id || "",
      name: apt.barber?.name || apt.barber?.email || "Barber",
      email: apt.barber?.email || "",
      phone: apt.barber?.phone || "",
    },
    startAt: apt.startAt.toISOString(),
    endAt: apt.endAt.toISOString(),
    status: apt.status,
    type: apt.type,
    address: apt.address || null,
    notes: apt.notes || null,
    isFree: apt.isFree || false,
    kind: apt.kind || null,
  }));

  if (process.env.NODE_ENV !== "production") {
    console.log("[barber-dashboard] scope", {
      role: user.role,
      barberIdFilter: user.role === "OWNER" ? null : user.id,
    });
    // Dev log: check phone fields
    const sampleAppt = formattedAppointments[0];
    if (sampleAppt) {
      console.log("[barber-dashboard] sample appointment contact data", {
        clientEmail: sampleAppt.client.email || "missing",
        clientPhone: sampleAppt.client.phone || "missing",
        barberEmail: sampleAppt.barber.email || "missing",
        barberPhone: sampleAppt.barber.phone || "missing",
      });
    }
  }

  // Explicit role guard to narrow TypeScript type
  if (user.role !== "BARBER" && user.role !== "OWNER") {
    redirect("/account");
  }

  // TypeScript now knows user.role is "BARBER" | "OWNER"
  const barberRole = user.role;

  // Format completed history for client component
  const formattedCompletedHistory = completedHistory.map((apt) => ({
    id: apt.id,
    client: {
      id: apt.client.id,
      name: apt.client.name || apt.client.email || "Client",
      email: apt.client.email || "",
      phone: apt.client.phone || "",
    },
    barber: {
      id: apt.barber?.id || "",
      name: apt.barber?.name || apt.barber?.email || "Barber",
      email: apt.barber?.email || "",
      phone: apt.barber?.phone || "",
    },
    startAt: apt.startAt.toISOString(),
    endAt: apt.endAt.toISOString(),
    status: apt.status,
    type: apt.type,
    address: apt.address || null,
    notes: apt.notes || null,
    isFree: apt.isFree || false,
    kind: apt.kind || null,
  }));

  return (
    <BarberDashboardClient
      barberId={user.id}
      barberRole={barberRole}
      appointments={formattedAppointments}
      completedHistory={formattedCompletedHistory}
    />
  );
}
