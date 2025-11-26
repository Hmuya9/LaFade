"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppointmentCard } from "@/components/ui/appointment-card";
import type { AppointmentCardData } from "@/components/ui/appointment-card";
import { Calendar, Clock, User, MapPin } from "lucide-react";
import { format } from "date-fns";

type BarberAppointment = {
  id: string;
  client: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  plan: string;
  startAt: string;
  endAt: string;
  status: "BOOKED" | "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELED";
  type: "SHOP" | "HOME";
  address: string | null;
  notes: string | null;
  isFree: boolean;
};

type MyScheduleData = {
  today: BarberAppointment[];
  next7: BarberAppointment[];
};

export function MyScheduleSection() {
  const [data, setData] = useState<MyScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        setLoading(true);
        const response = await fetch("/api/barber/appointments/me");
        
        if (!response.ok) {
          throw new Error("Failed to fetch schedule");
        }
        
        const scheduleData = await response.json();
        setData(scheduleData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load schedule");
      } finally {
        setLoading(false);
      }
    }

    fetchSchedule();
  }, []);

  const handleStatusUpdate = async (appointmentId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update status");
      }

      // Refresh schedule
      const refreshResponse = await fetch("/api/barber/appointments/me");
      if (refreshResponse.ok) {
        const scheduleData = await refreshResponse.json();
        setData(scheduleData);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const formatAppointmentForCard = (apt: BarberAppointment): AppointmentCardData => {
    return {
      id: apt.id,
      barber: {
        id: apt.client.id,
        name: apt.client.name,
        photo: null
      },
      plan: apt.plan,
      startAt: apt.startAt,
      endAt: apt.endAt,
      status: apt.status,
      type: apt.type,
      address: apt.address,
      notes: apt.notes
    };
  };

  if (loading) {
    return (
      <Card className="rounded-2xl shadow-md border-slate-200/60 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-rose-500" />
            My Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600">Loading schedule...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-2xl shadow-md border-slate-200/60 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-rose-500" />
            My Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const today = data?.today || [];
  const next7 = data?.next7 || [];

  return (
    <Card className="rounded-2xl shadow-md border-slate-200/60 bg-white">
      <CardHeader className="bg-gradient-to-br from-slate-50 to-rose-50/20 rounded-t-2xl border-b">
        <CardTitle className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <Calendar className="w-6 h-6 text-rose-500" />
          My Schedule
        </CardTitle>
        <CardDescription className="text-slate-600">
          Manage your upcoming appointments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Today's Appointments */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Today ({format(new Date(), "EEEE, MMMM d")})
          </h3>
          {today.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
              <p>No appointments scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-4">
              {today.map((apt) => (
                <div
                  key={apt.id}
                  className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-slate-600" />
                        <span className="font-semibold text-slate-900">
                          {apt.client.name}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          {apt.plan}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          {format(new Date(apt.startAt), "h:mm a")} - {format(new Date(apt.endAt), "h:mm a")}
                        </div>
                        {apt.type === "HOME" && apt.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5" />
                            {apt.address}
                          </div>
                        )}
                        {apt.notes && (
                          <p className="text-slate-500 italic">"{apt.notes}"</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      {apt.status === "BOOKED" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate(apt.id, "CONFIRMED")}
                            className="bg-rose-500 hover:bg-rose-600 text-white"
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusUpdate(apt.id, "CANCELED")}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                      {apt.status === "CONFIRMED" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate(apt.id, "COMPLETED")}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                          >
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusUpdate(apt.id, "NO_SHOW")}
                          >
                            No Show
                          </Button>
                        </>
                      )}
                      {apt.status === "COMPLETED" && (
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Next 7 Days */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-rose-500" />
            Next 7 Days
          </h3>
          {next7.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
              <p>No appointments scheduled for the next 7 days</p>
            </div>
          ) : (
            <div className="space-y-4">
              {next7.map((apt) => (
                <div
                  key={apt.id}
                  className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-slate-600" />
                        <span className="font-semibold text-slate-900">
                          {apt.client.name}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          {apt.plan}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(apt.startAt), "EEEE, MMMM d")}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          {format(new Date(apt.startAt), "h:mm a")} - {format(new Date(apt.endAt), "h:mm a")}
                        </div>
                        {apt.type === "HOME" && apt.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5" />
                            {apt.address}
                          </div>
                        )}
                        {apt.notes && (
                          <p className="text-slate-500 italic">"{apt.notes}"</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      {apt.status === "BOOKED" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate(apt.id, "CONFIRMED")}
                            className="bg-rose-500 hover:bg-rose-600 text-white"
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusUpdate(apt.id, "CANCELED")}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                      {apt.status === "CONFIRMED" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate(apt.id, "COMPLETED")}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                          >
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusUpdate(apt.id, "NO_SHOW")}
                          >
                            No Show
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}



