"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, MapPin, Scissors } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import type { AppointmentCardData } from "@/components/ui/appointment-card";

interface NextAppointmentCardProps {
  nextAppointment: AppointmentCardData;
}

export function NextAppointmentCard({ nextAppointment }: NextAppointmentCardProps) {
  if (!nextAppointment) {
    return null;
  }

  const startDate = new Date(nextAppointment.startAt);
  const endDate = new Date(nextAppointment.endAt);

  return (
    <Card className="rounded-2xl shadow-sm border-rose-200/60 bg-gradient-to-br from-rose-50/40 to-amber-50/30">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Barber Photo/Avatar */}
          <div className="relative flex-shrink-0">
            {nextAppointment.barber.photo ? (
              <img
                src={nextAppointment.barber.photo}
                alt={nextAppointment.barber.name}
                className="h-16 w-16 rounded-full object-cover ring-2 ring-rose-200"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-200 to-amber-200 ring-2 ring-rose-200">
                <User className="w-8 h-8 text-rose-600" />
              </div>
            )}
          </div>

          {/* Appointment Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Scissors className="w-4 h-4 text-rose-500" />
              <span className="text-sm font-semibold text-rose-900">Your Next Cut</span>
            </div>

            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <User className="w-4 h-4 text-slate-600" />
                <span className="font-semibold text-slate-900">{nextAppointment.barber.name}</span>
              </div>

              <div className="flex items-center gap-1.5 mb-1 text-sm text-slate-600">
                <Calendar className="w-4 h-4 text-rose-500" />
                <span>{format(startDate, "EEEE, MMMM d")}</span>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Clock className="w-4 h-4 text-rose-500" />
                <span>
                  {format(startDate, "h:mm a")} – {format(endDate, "h:mm a")}
                </span>
              </div>

              {nextAppointment.type === "HOME" && nextAppointment.address && (
                <div className="flex items-start gap-1.5 mt-1 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-1">{nextAppointment.address}</span>
                </div>
              )}
            </div>

            {/* Confirmation Message */}
            <div className="mt-4 pt-4 border-t border-rose-200/60">
              <p className="text-sm text-slate-700 leading-relaxed">
                You&apos;re booked with{" "}
                <span className="font-semibold text-slate-900">
                  {nextAppointment.barber.name}
                </span>
                {(nextAppointment.barber.city && nextAppointment.barber.city.trim())
                  ? ` in ${nextAppointment.barber.city}`
                  : " in your area"}
                . For exact address or any questions, text or call your barber or
                LaFade at{" "}
                <span className="font-semibold text-slate-900">425-524-2909</span>.
                We respond fast.
              </p>
            </div>

            <Link href="/account#appointments">
              <Button className="w-full mt-4 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white shadow-md hover:shadow-lg transition-all duration-150 ease-out active:scale-95 active:shadow-inner">
                Manage Appointment
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

