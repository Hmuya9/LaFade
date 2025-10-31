"use client";

import { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/ui/ErrorState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignInButton } from "@/components/SignInButton";
import { env } from "@/lib/env";
import { PLANS } from "@/config/plans";

const bookingSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Please enter a valid email"),
  customerPhone: z.string().min(10, "Please enter a valid phone number"),
  selectedDate: z.string().min(1, "Please select a date"),
  selectedTime: z.string().min(1, "Please select a time"),
  selectedBarber: z.string().min(1, "Please select a barber"),
  plan: z.enum(["standard", "deluxe", "trial"]),
  location: z.string().optional(),
  notes: z.string().optional(),
});

type BookingForm = z.infer<typeof bookingSchema>;

export const dynamic = 'force-dynamic';

function BookingForm() {
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [successData, setSuccessData] = useState<{ emailed: boolean; icsUrl?: string; message?: string } | null>(null);
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);
  const { data: session, status } = useSession();

  // Single barber setup
  const BARBER_NAME = process.env.NEXT_PUBLIC_BARBER_NAME ?? "CKENZO";

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      plan: (searchParams.get("plan") as "standard" | "deluxe" | "trial") || "standard",
      selectedBarber: BARBER_NAME, // Default to the single barber
    },
  });

  // Fetch points balance when user is logged in
  useEffect(() => {
    if (session?.user) {
      fetch("/api/me")
        .then(res => res.json())
        .then(data => setPointsBalance(data.points))
        .catch(err => console.error("Failed to fetch points:", err));
    }
  }, [session]);

  // Prefill form from session
  useEffect(() => {
    if (session?.user?.email) {
      setValue("customerEmail", session.user.email);
      if (session.user.name) {
        setValue("customerName", session.user.name);
      }
    }
  }, [session, setValue]);

  // Handle URL parameters for success/cancel from Stripe
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    
    if (success === 'true') {
      setShowSuccess(true);
      setSuccessData({ 
        emailed: true, 
        message: "Payment successful! Your appointment has been booked and confirmation email sent." 
      });
      setTimeout(() => setShowSuccess(false), 10000);
    } else if (canceled === 'true') {
      setError("Payment was canceled. Your appointment was not booked.");
    }
  }, []);

  const selectedPlan = watch("plan");
  const selectedBarber = watch("selectedBarber");
  const selectedDate = watch("selectedDate");

  const barbers = [{ id: "1", name: BARBER_NAME, available: true }];

  // Fetch available slots when barber and date change
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!selectedBarber || !selectedDate) {
        setAvailableSlots([]);
        return;
      }

      setLoadingSlots(true);
      try {
        const params = new URLSearchParams({
          barberName: selectedBarber,
          date: selectedDate,
          plan: selectedPlan || '',
        });

        const response = await fetch(`/api/availability?${params}`);
        if (!response.ok) throw new Error('Failed to fetch availability');
        
        const data = await response.json();
        const slots = data.availableSlots?.map((slot: any) => slot.time) || [];
        setAvailableSlots(slots);
        
        // Clear selected time if it's no longer available
        const currentTime = watch("selectedTime");
        if (currentTime && !slots.includes(currentTime)) {
          setValue("selectedTime", "");
        }
      } catch (error) {
        console.error('Availability fetch error:', error);
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchAvailability();
  }, [selectedBarber, selectedDate, selectedPlan, setValue, watch]);

  // Generate deterministic idempotency key
  const generateIdempotencyKey = () => {
    const email = watch("customerEmail");
    const barber = watch("selectedBarber");
    const date = watch("selectedDate");
    const time = watch("selectedTime");
    
    if (email && barber && date && time) {
      return btoa(`${email}|${barber}|${date}|${time}`).replace(/[+/=]/g, '').substring(0, 32);
    }
    return null;
  };

  const onSubmit = async (data: BookingForm) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // For trial bookings, use the existing direct booking flow
      if (data.plan === "trial") {
        const idempotencyKey = generateIdempotencyKey();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        
        if (idempotencyKey) {
          headers['idempotency-key'] = idempotencyKey;
        }

        const res = await fetch("/api/bookings", {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        });

        const result = await res.json();

        if (res.status === 409) {
          throw new Error(result.error || "That time slot was just taken. Please pick another time.");
        }

        if (!res.ok) {
          throw new Error(result.error || "Failed to create booking");
        }

        setShowSuccess(true);
        setSuccessData({ emailed: result.emailed, icsUrl: result.icsUrl });
        setTimeout(() => setShowSuccess(false), 5000);
        
        // Refresh availability to remove the booked slot
        if (selectedBarber && selectedDate) {
          const params = new URLSearchParams({
            barberName: selectedBarber,
            date: selectedDate,
            plan: selectedPlan || '',
          });
          await fetch(`/api/availability?${params}`);
        }
        return;
      }

      // For paid plans, redirect to Stripe Checkout
      const checkoutRes = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentData: {
            customerName: data.customerName,
            customerEmail: data.customerEmail,
            customerPhone: data.customerPhone,
            selectedDate: data.selectedDate,
            selectedTime: data.selectedTime,
            selectedBarber: data.selectedBarber,
            plan: data.plan,
            location: data.location,
            notes: data.notes,
          }
        }),
      });

      const checkoutResult = await checkoutRes.json();

      if (!checkoutRes.ok) {
        throw new Error(checkoutResult.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      if (checkoutResult.url) {
        window.location.href = checkoutResult.url;
      } else {
        throw new Error("No checkout URL received");
      }
      
    } catch (e: any) {
      setError(e?.message || "Failed to submit booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="flex justify-between items-center mb-4">
            <div></div>
            <h1 className="text-4xl font-bold text-zinc-900">
              Book Your Cut
            </h1>
            <div className="flex items-center gap-2">
              {session?.user?.role === "CLIENT" && pointsBalance !== null && (
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  Points: {pointsBalance}
                </div>
              )}
              <SignInButton />
            </div>
          </div>
          <p className="text-xl text-zinc-600">
            Choose your date, time, and barber
          </p>
        </div>

        {!session && (
          <Alert className="mb-6">
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>Please sign in to book an appointment.</span>
                <a href="/client/login" className="text-blue-600 hover:text-blue-800 underline">Sign In</a>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {session && pointsBalance !== null && pointsBalance < 5 && (
          <Alert className="mb-6">
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>Not enough points — Subscribe to continue</span>
                <a href="/account" className="text-blue-600 hover:text-blue-800 underline">Subscribe</a>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {showSuccess && (
          <Alert className="mb-6">
            <AlertDescription>
              <div className="flex flex-col space-y-3">
                <p className="font-semibold text-green-800">
                  ✓ Booking confirmed!
                </p>
                
                {successData?.message ? (
                  <p className="text-sm text-green-700">
                    {successData.message}
                  </p>
                ) : successData?.emailed ? (
                  <p className="text-sm text-green-700">
                    📧 We&apos;ve emailed your confirmation and calendar invite to {watch('customerEmail')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-green-700">
                      📅 Calendar invite not emailed. Add to your calendar manually:
                    </p>
                    <button
                      onClick={() => {
                        if (successData?.icsUrl) {
                          window.open(successData.icsUrl, '_blank');
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      📅 Add to Calendar
                    </button>
                  </div>
                )}
                
                <p className="text-sm text-green-700">
                  We&apos;ll contact you if there are any changes needed.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <div className="mb-6">
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">
                <p className="font-semibold mb-1">Booking Failed</p>
                <p>{error}</p>
                {error.includes("time") && (
                  <p className="text-sm mt-2 text-red-600">
                    💡 Try selecting a different time or checking with another barber.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}

        <Card className="rounded-2xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-center">Booking Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className={`space-y-6 ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}>
              <div className="grid md:grid-cols-2 gap-8">
                {/* Left Column - Booking Details */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-zinc-900">Appointment Details</h3>
                  
                  {/* Plan Selection */}
                  <div>
                    <Label htmlFor="plan" className="text-sm font-medium text-zinc-700 mb-2 block">
                      Select Plan *
                    </Label>
                    <div className="space-y-2">
                      {PLANS.map((plan) => (
                        <label key={plan.id} className="flex items-center space-x-2">
                          <input
                            type="radio"
                            value={plan.id}
                            {...register("plan")}
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-sm text-zinc-700">
                            {plan.name} - ${(plan.priceMonthlyCents/100).toFixed(2)}/month ({plan.isHome ? "Home" : "Shop"})
                          </span>
                        </label>
                      ))}
                    </div>
                    
                    {/* Trial hint */}
                    {selectedPlan === "trial" && (
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800">
                          🎉 No payment needed. One free trial per person to try our service!
                        </p>
                      </div>
                    )}
                    
                    {errors.plan && (
                      <p className="text-sm text-red-600 mt-1">{errors.plan.message}</p>
                    )}
                  </div>

                  {/* Date Selection */}
                  <div>
                    <Label htmlFor="selectedDate" className="text-sm font-medium text-zinc-700 mb-2 block">
                      Select Date *
                    </Label>
                    <Input
                      type="date"
                      {...register("selectedDate")}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    {errors.selectedDate && (
                      <p className="text-sm text-red-600 mt-1">{errors.selectedDate.message}</p>
                    )}
                  </div>

                  {/* Time Selection */}
                  <div>
                    <Label className="text-sm font-medium text-zinc-700 mb-2 block">
                      Select Time * {loadingSlots && <span className="text-xs text-zinc-500">(Loading...)</span>}
                    </Label>
                    
                    {availableSlots.length === 0 && selectedBarber && selectedDate && !loadingSlots && (
                      <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg mb-3">
                        No available slots for this barber and date. Please try another date.
                      </div>
                    )}
                    
                    <div className="grid grid-cols-3 gap-2">
                      {availableSlots.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setValue("selectedTime", time)}
                          className={`px-3 py-2 rounded-lg border transition-colors text-sm ${
                            watch("selectedTime") === time
                              ? "bg-zinc-900 text-white border-zinc-900"
                              : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                    
                    {!selectedDate ? (
                      <p className="text-sm text-zinc-500 mt-2">Select date to see available times</p>
                    ) : null}
                    
                    {errors.selectedTime && (
                      <p className="text-sm text-red-600 mt-1">{errors.selectedTime.message}</p>
                    )}
                  </div>

                  {/* Barber Selection */}
                  <div>
                    <Label className="text-sm font-medium text-zinc-700 mb-2 block">
                      Your Barber: {BARBER_NAME}
                    </Label>
                    <div className="space-y-2">
                      {barbers.map((barber) => (
                        <button
                          key={barber.id}
                          type="button"
                          onClick={() => setValue("selectedBarber", barber.name)}
                          className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                            watch("selectedBarber") === barber.name
                              ? "bg-zinc-900 text-white border-zinc-900"
                              : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          {barber.name}
                        </button>
                      ))}
                    </div>
                    {errors.selectedBarber && (
                      <p className="text-sm text-red-600 mt-1">{errors.selectedBarber.message}</p>
                    )}
                  </div>

                  {/* Location for Deluxe */}
                  {selectedPlan === "deluxe" && (
                    <div>
                      <Label htmlFor="location" className="text-sm font-medium text-zinc-700 mb-2 block">
                        Home Address *
                      </Label>
                      <Input
                        {...register("location")}
                        placeholder="Enter your home address"
                      />
                      {errors.location && (
                        <p className="text-sm text-red-600 mt-1">{errors.location.message}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Column - Customer Info */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-zinc-900">Your Information</h3>
                  
                  <div>
                    <Label htmlFor="customerName" className="text-sm font-medium text-zinc-700 mb-2 block">
                      Full Name *
                    </Label>
                    <Input
                      {...register("customerName")}
                      placeholder="Enter your full name"
                    />
                    {errors.customerName && (
                      <p className="text-sm text-red-600 mt-1">{errors.customerName.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="customerEmail" className="text-sm font-medium text-zinc-700 mb-2 block">
                      Email *
                    </Label>
                    <Input
                      type="email"
                      {...register("customerEmail")}
                      placeholder="Enter your email"
                      disabled={!!session?.user?.email}
                    />
                    {errors.customerEmail && (
                      <p className="text-sm text-red-600 mt-1">{errors.customerEmail.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="customerPhone" className="text-sm font-medium text-zinc-700 mb-2 block">
                      Phone Number *
                    </Label>
                    <Input
                      type="tel"
                      {...register("customerPhone")}
                      placeholder="Enter your phone number"
                    />
                    {errors.customerPhone && (
                      <p className="text-sm text-red-600 mt-1">{errors.customerPhone.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="notes" className="text-sm font-medium text-zinc-700 mb-2 block">
                      Special Requests (Optional)
                    </Label>
                    <textarea
                      {...register("notes")}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
                      rows={3}
                      placeholder="Any specific styling preferences or notes..."
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-6">
                <Button
                  type="submit"
                  disabled={isSubmitting || !session || (pointsBalance !== null && pointsBalance < 5)}
                  aria-busy={isSubmitting}
                  className="w-full"
                  size="lg"
                >
                  {isSubmitting ? "Submitting..." : 
                   !session ? "Sign In to Book" :
                   (pointsBalance !== null && pointsBalance < 5) ? "Insufficient Points" :
                   "Confirm Booking"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Back to Plans */}
        <div className="text-center mt-8">
          <a 
            href="/plans"
            className="text-zinc-600 hover:text-zinc-800 underline"
          >
            ← Back to Plans
          </a>
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={null}>
      <BookingForm />
    </Suspense>
  );
}

