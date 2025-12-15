"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarberPhotosSection } from "./BarberPhotosSection";
import { RealtimeBookingsPanel } from "./RealtimeBookingsPanel";
import { WeeklyAvailabilityForm } from "./WeeklyAvailabilityForm";
import { MyScheduleSection } from "./MyScheduleSection";
import { WeeklyScheduleCalendarWrapper } from "./WeeklyScheduleCalendarWrapper";
import { BarberCityForm } from "./BarberCityForm";
import { MetricCard } from "@/components/MetricCard";
import { TimeRangeClient } from "@/components/TimeRangeClient";

type Appointment = {
  id: string;
  client: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  barber: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  startAt: string;
  endAt: string;
  status: string;
  type: string;
  address: string | null;
  notes: string | null;
  isFree: boolean;
  kind: string | null;
};

type BarberMetrics = {
  activeMembers: number;
  freeCutsGiven: number;
  freeCutClients: number;
  conversionRate: number;
  utilizationThisWeek: number;
  monthlyEarningsCents: number;
};

type BarberDashboardClientProps = {
  barberId: string;
  barberRole: "BARBER" | "OWNER";
  appointments: Appointment[];
};

export function BarberDashboardClient({
  barberId,
  barberRole,
  appointments: initialAppointments,
}: BarberDashboardClientProps) {
  const [error, setError] = useState("");
  const [qrApptId, setQrApptId] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [metrics, setMetrics] = useState<BarberMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Fetch barber metrics on mount
  useEffect(() => {
    async function fetchMetrics() {
      try {
        setMetricsLoading(true);
        const response = await fetch("/api/barber/metrics");
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        } else {
          // On error, set metrics to null (will show placeholders)
          setMetrics(null);
        }
      } catch (err) {
        console.error("Failed to fetch barber metrics:", err);
        setMetrics(null);
      } finally {
        setMetricsLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  // Format currency helper
  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Format percentage helper
  const formatPercentage = (rate: number) => {
    return `${Math.round(rate * 100)}%`;
  };

  // Format appointment type/plan name
  const getPlanName = (apt: Appointment) => {
    if (apt.isFree) return "Free Test Cut";
    if (apt.type === "HOME") return "Deluxe";
    if (apt.kind === "DISCOUNT_SECOND") return "$10 Second Cut";
    return "Standard";
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">Today&apos;s Schedule</h1>
          <p className="text-zinc-600">View your appointments and manage your availability</p>
        </div>

        {/* My Performance Section */}
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-zinc-900">My Performance</h2>
            <p className="text-sm text-zinc-500">See how your members and cuts are tracking.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Active Members"
              value={metricsLoading ? "—" : (metrics?.activeMembers ?? 0)}
              icon="👥"
            />
            <MetricCard
              title="Free Cuts Given"
              value={metricsLoading ? "—" : (metrics?.freeCutsGiven ?? 0)}
              icon="✂️"
            />
            <MetricCard
              title="Free → Member Conversion"
              value={metricsLoading ? "—" : (metrics ? formatPercentage(metrics.conversionRate) : "0%")}
              icon="📈"
            />
            <MetricCard
              title="This Week&apos;s Cuts"
              value={metricsLoading ? "—" : (metrics?.utilizationThisWeek ?? 0)}
              icon="📅"
            />
            <MetricCard
              title="Est. Monthly Earnings"
              value={metricsLoading ? "—" : (metrics ? `${formatCurrency(metrics.monthlyEarningsCents)} / month` : "$0.00 / month")}
              icon="💰"
            />
          </div>
        </section>

        {/* Upcoming Appointments Section */}
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-zinc-900">Upcoming Appointments</h2>
            <p className="text-sm text-zinc-500">
              {initialAppointments.length === 0
                ? "No upcoming appointments"
                : `${initialAppointments.length} appointment${initialAppointments.length === 1 ? "" : "s"} scheduled`}
            </p>
          </div>

          {initialAppointments.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-zinc-600 mb-2">No upcoming appointments</p>
                <p className="text-sm text-zinc-500">
                  New bookings will appear here once clients schedule with you.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {initialAppointments.map((apt) => (
                <Card key={apt.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-zinc-900">
                            {apt.client.name}
                          </h3>
                          <span className="text-xs px-2 py-1 rounded bg-zinc-100 text-zinc-700">
                            {getPlanName(apt)}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              apt.status === "CONFIRMED"
                                ? "bg-green-100 text-green-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {apt.status}
                          </span>
                        </div>
                        <div className="text-sm text-zinc-600 space-y-1">
                          <p>
                            <TimeRangeClient
                              startAt={apt.startAt}
                              endAt={apt.endAt}
                              showDate={true}
                              dateFormat="EEE MMM d"
                              timeFormat="p"
                            />
                          </p>
                          {apt.type === "HOME" && apt.address && (
                            <p className="text-zinc-500">📍 {apt.address}</p>
                          )}
                          {apt.notes && (
                            <p className="text-zinc-500 italic">Note: {apt.notes}</p>
                          )}
                          {apt.client.phone && (
                            <p className="text-zinc-500">📞 {apt.client.phone}</p>
                          )}
                        </div>
                        {/* Contact Info */}
                        <div className="mt-3 pt-3 border-t border-zinc-200 text-xs text-zinc-600 space-y-1">
                          <p className="font-medium text-zinc-700">Client Contact:</p>
                          <p>📧 {apt.client.email || "—"}</p>
                          {apt.client.phone ? (
                            <p>
                              📞 <a href={`tel:${apt.client.phone}`} className="text-rose-600 hover:text-rose-700 underline">{apt.client.phone}</a>
                            </p>
                          ) : (
                            <p className="text-zinc-400">📞 No phone on file</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <div className="mb-6">
          <RealtimeBookingsPanel />
        </div>

        {error && (
          <Alert className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mb-6">
          <BarberCityForm />
        </div>

        <div className="mb-6">
          <BarberPhotosSection />
        </div>

        <div className="mb-6">
          <WeeklyAvailabilityForm />
        </div>

        <div className="mb-6">
          <WeeklyScheduleCalendarWrapper />
        </div>

        <div className="mb-6">
          <MyScheduleSection />
        </div>

        {/* QR generator for client cut confirmation */}
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Cut Confirmation QR</CardTitle>
              <CardDescription>
                Generate a QR code for a specific appointment so your client can confirm their cut.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!qrApptId || !barberId) return;
                  setShowQr(true);
                }}
                className="flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <Input
                  placeholder="Appointment ID"
                  value={qrApptId}
                  onChange={(e) => setQrApptId(e.target.value)}
                  className="flex-1"
                  required
                />
                <Button type="submit" variant="outline">
                  Show QR for client
                </Button>
              </form>
              <p className="text-xs text-zinc-500">
                This will generate a link like{" "}
                <span className="font-mono">
                  /cut/confirm?appt=APPT_ID&amp;b=BARBER_ID
                </span>{" "}
                for your client to scan.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Full-screen QR overlay */}
        {showQr && barberId && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 px-4">
            <div className="mb-4 text-center text-white">
              <h2 className="text-xl font-semibold">Have your client scan this QR</h2>
              <p className="text-sm text-zinc-200 mt-1">
                This will open their confirmation screen for this appointment.
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
                  `${typeof window !== "undefined" ? window.location.origin : "https://lafade.com"}/cut/confirm?appt=${qrApptId}&b=${barberId}`
                )}&size=280x280`}
                alt="Cut confirmation QR code"
                className="h-72 w-72"
              />
            </div>
            <Button
              variant="outline"
              className="mt-6 text-white border-white/60 hover:bg-white/10"
              onClick={() => setShowQr(false)}
            >
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

