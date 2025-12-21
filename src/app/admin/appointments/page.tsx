import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Calendar, Clock, User, MapPin, FileText, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { AppointmentFiltersClient } from "./_components/AppointmentFiltersClient";

export const dynamic = 'force-dynamic';

export default async function AdminAppointments({
  searchParams,
}: {
  searchParams: { status?: string; barberId?: string; dateFrom?: string; dateTo?: string };
}) {
  await requireAdmin();
  
  const now = new Date();
  
  // Get all barbers for filter dropdown
  const barbers = await prisma.user.findMany({
    where: {
      role: { in: ["BARBER", "OWNER"] },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  // Build filter conditions
  const where: any = {};
  
  // Status filter
  if (searchParams.status && searchParams.status !== "ALL") {
    where.status = searchParams.status;
  }
  
  // Barber filter
  if (searchParams.barberId && searchParams.barberId !== "ALL") {
    where.barberId = searchParams.barberId;
  }
  
  // Date range filter (default: next 7 days if no dates specified)
  if (searchParams.dateFrom || searchParams.dateTo) {
    where.startAt = {};
    if (searchParams.dateFrom) {
      where.startAt.gte = new Date(searchParams.dateFrom);
    }
    if (searchParams.dateTo) {
      const dateTo = new Date(searchParams.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      where.startAt.lte = dateTo;
    }
  } else {
    // Default: next 7 days
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);
    where.startAt = {
      gte: now,
      lte: next7Days,
    };
  }
  
  const appts = await prisma.appointment.findMany({
    where,
    orderBy: { startAt: "asc" },
    include: { 
      client: { select: { name: true, email: true, phone: true } },
      barber: { select: { name: true, email: true } },
    },
    take: 200, // Limit to 200 results
  });

  // Needs Attention: 
  // 1. BOOKED appointments created > 24 hours ago (Note: using startAt as proxy since createdAt doesn't exist in schema)
  // 2. CONFIRMED appointments with startAt > 6 hours ago (and not COMPLETED)
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  
  // For BOOKED: Find appointments that are still BOOKED but startAt is in the past (should have been confirmed)
  // This is a proxy for "created > 24h ago" since we don't have createdAt field
  const needsAttention = await prisma.appointment.findMany({
    where: {
      OR: [
        {
          status: "BOOKED",
          // Using startAt as proxy: if appointment was supposed to start > 24h ago but still BOOKED, needs attention
          startAt: { lte: twentyFourHoursAgo },
        },
        {
          status: "CONFIRMED",
          startAt: { lte: sixHoursAgo },
          // Already filtered by status, but being explicit
        },
      ],
    },
    include: {
      client: { select: { name: true, email: true, phone: true } },
      barber: { select: { name: true, email: true } },
    },
    orderBy: { startAt: "asc" },
    take: 50,
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">All Appointments</h1>
          <p className="text-slate-600">View and manage all appointments with filters</p>
        </div>

        {/* Needs Attention Section */}
        {needsAttention.length > 0 && (
          <Card className="mb-6 border-amber-200 bg-amber-50/50">
            <CardHeader className="bg-gradient-to-br from-amber-50 to-rose-50/20 rounded-t-2xl border-b border-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <CardTitle className="text-xl font-semibold text-amber-900">Needs Attention</CardTitle>
              </div>
              <CardDescription className="text-amber-700">
                {needsAttention.length} appointment{needsAttention.length !== 1 ? 's' : ''} requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {needsAttention.map((apt) => {
                  let planName = "Standard";
                  if (apt.isFree) {
                    planName = "Free Test Cut";
                  } else if (apt.type === "HOME") {
                    planName = "Deluxe";
                  }

                  return (
                    <div
                      key={apt.id}
                      className="border border-amber-200 rounded-xl p-5 bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <StatusBadge status={apt.status} />
                            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                              {planName}
                            </span>
                            {apt.status === "BOOKED" && (
                              <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">
                                Booked &gt; 24h ago
                              </span>
                            )}
                            {apt.status === "CONFIRMED" && (
                              <span className="text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-medium">
                                Confirmed &gt; 6h ago
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-rose-500" />
                              <span className="font-medium text-slate-900">
                                {format(new Date(apt.startAt), "EEEE, MMMM d, yyyy")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-rose-500" />
                              <span>
                                {format(new Date(apt.startAt), "h:mm a")} - {format(new Date(apt.endAt), "h:mm a")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-slate-400" />
                              <span className="font-medium text-slate-900">
                                {apt.client?.name || apt.client?.email || "Client"}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span>{apt.client?.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-500">Barber:</span>
                              <span className="font-medium text-slate-900">
                                {apt.barber?.name || apt.barber?.email || "Barber"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <AppointmentFiltersClient barbers={barbers} searchParams={searchParams} />

        <Card className="rounded-2xl shadow-md border-slate-200/60 bg-white">
          <CardHeader className="bg-gradient-to-br from-slate-50 to-rose-50/20 rounded-t-2xl border-b">
            <CardTitle className="text-2xl font-semibold text-slate-900">All Appointments</CardTitle>
            <CardDescription className="text-slate-600">
              {appts.length} appointment{appts.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {appts.length === 0 ? (
              <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p className="text-lg font-medium">No upcoming appointments</p>
              </div>
            ) : (
              <div className="space-y-4">
                {appts.map((apt) => {
                  let planName = "Standard";
                  if (apt.isFree) {
                    planName = "Free Test Cut";
                  } else if (apt.type === "HOME") {
                    planName = "Deluxe";
                  }

                  return (
                    <div
                      key={apt.id}
                      className="border border-slate-200 rounded-xl p-5 bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <StatusBadge status={apt.status} />
                            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                              {planName}
                            </span>
                            {apt.type === "HOME" && (
                              <span className="text-xs px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 font-medium">
                                Home Service
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-rose-500" />
                              <span className="font-medium text-slate-900">
                                {format(new Date(apt.startAt), "EEEE, MMMM d, yyyy")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-rose-500" />
                              <span>
                                {format(new Date(apt.startAt), "h:mm a")} - {format(new Date(apt.endAt), "h:mm a")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-slate-400" />
                              <span className="font-medium text-slate-900">
                                {apt.client?.name || apt.client?.email || "Client"}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span>{apt.client?.email}</span>
                              {apt.client?.phone && (
                                <>
                                  <span className="text-slate-400">•</span>
                                  <span>{apt.client.phone}</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-500">Barber:</span>
                              <span className="font-medium text-slate-900">
                                {apt.barber?.name || apt.barber?.email || "Barber"}
                              </span>
                            </div>
                            {apt.type === "HOME" && apt.address && (
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                <span className="line-clamp-2">{apt.address}</span>
                              </div>
                            )}
                            {apt.notes && (
                              <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
                                <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-600 italic">"{apt.notes}"</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}




