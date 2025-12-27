"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MyScheduleSection } from "../_components/MyScheduleSection";
import { BookingForm } from "@/app/booking/_components/BookingForm";

export default function BarberBookPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    
    // Middleware protects this route, but client-side check as backup
    const role = (session?.user as any)?.role;
    if (!session || (role !== "BARBER" && role !== "OWNER")) {
      router.push("/barber/login");
      return;
    }
  }, [session, status, router]);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  // Middleware protects this route, but client-side check as backup
  const role = (session?.user as any)?.role;
  const barberId = (session?.user as any)?.id as string | undefined;
  if (!session || (role !== "BARBER" && role !== "OWNER")) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">Book a client</h1>
          <p className="text-zinc-600">Create a new appointment for a walk-in or phone booking</p>
        </div>

        {/* Primary focus: Booking form */}
        <div className="mb-8">
          <BookingForm defaultBarberId={barberId} />
        </div>

        {/* Secondary: Schedule view (acceptable for now) */}
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Schedule</CardTitle>
              <CardDescription>View your upcoming appointments</CardDescription>
            </CardHeader>
            <CardContent>
              <MyScheduleSection />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}







