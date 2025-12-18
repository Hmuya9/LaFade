/**
 * BookingForm Component
 * 
 * Client booking form with polished UX following IG/Snap simplicity:
 * - Mini calendar strip showing upcoming week availability
 * - Weekly availability summary with animated pills
 * - Clickable day pills that set the date
 * - "Next 3 openings" banner
 * - Free Test Cut visual clarity (no points blocking)
 * - Icons throughout for visual hierarchy
 * - Subtle animations for micro-interactions
 * 
 * State Management:
 * - Form state via react-hook-form
 * - Available slots fetched when barber + date change
 * - Weekly summary fetched when barber changes
 * - Next openings fetched when barber + plan change
 * 
 * Social-Ready Structure:
 * - Reusable Pill component for future feeds/profiles
 * - AnimatedList wrapper for smooth transitions
 * - Date utils for calendar features
 */

"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Calendar, Clock, User, Sparkles, MapPin, Phone, Mail, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/ui/ErrorState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignInButton } from "@/components/SignInButton";
import { Pill } from "@/components/ui/pill";
import { AnimatedList } from "@/components/ui/animated-list";
import { PLANS } from "@/config/plans";
import { BookingPortfolioSection } from "./BookingPortfolioSection";
import { isFreeTestCut } from "@/lib/plan-utils";
import { PRICING, formatPrice } from "@/lib/pricing";
import type { BarberDaySummary } from "@/lib/barber-weekly-summary";
import { formatTime12Hour, parseLocalDateTimeToUTC, BUSINESS_TIMEZONE } from "@/lib/time-utils";
import { getNext7Days, getNextDateForWeekday, formatDateShort, formatDateWithDay } from "@/lib/date-utils";
import { TimeSlotsSkeleton } from "@/components/ui/time-slots-skeleton";
import { laf } from "@/components/ui/lafadeStyles";
import { COPY, MEMBERSHIP_STANDARD_PRICE_CENTS } from "@/lib/lafadeBusiness";

type Opening = {
  date: string;
  time: string;
};

type BookingState =
  | { type: "FIRST_FREE" }
  | { type: "SECOND_DISCOUNT"; discountCents: number; deadline: string }
  | { type: "MEMBERSHIP_INCLUDED"; remainingCutsThisPeriod: number; planName?: string }
  | { type: "ONE_OFF" };

type BookingFormProps = {
  defaultBarberId?: string;
  // When true, this is the discounted second-cut flow; pricing is handled server-side.
  isSecondCut?: boolean;
  /**
   * Booking state determined server-side. Controls which pricing flow applies.
   */
  bookingState?: BookingState;
  /**
   * When true, client already has a TRIAL_FREE appointment (non-canceled),
   * so the free trial plan should be hidden and backend will reject new trials.
   */
  hasFreeCutBookedOrCompleted?: boolean;
  /**
   * When true, client has an active membership/subscription.
   * Used to determine if upsell band should be shown.
   */
  hasActiveMembership?: boolean;
  /**
   * Membership usage information (cutsAllowed, cutsUsed, cutsRemaining).
   * Only present when user has an active membership with cutsPerMonth > 0.
   */
  membershipUsage?: { cutsAllowed: number; cutsUsed: number; cutsRemaining: number } | null;
};

const DISABLED_BARBER_EMAILS = ["hussemuya.hm.hm@gmail.com"];
const isDisabledBarberEmail = (email?: string | null) =>
  email ? DISABLED_BARBER_EMAILS.includes(email.toLowerCase()) : false;

type BarberOption = { id: string; name: string | null; email: string | null; city?: string | null; role?: string };

const bookingSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Please enter a valid email"),
  customerPhone: z.string().min(10, "Please enter a valid phone number"),
  selectedDate: z.string().min(1, "Please select a date"),
  selectedTime: z.string().min(1, "Please select a time"),
  selectedBarber: z.string().min(1, "Please select a stylist"),
  plan: z.enum(["standard", "deluxe", "trial"]),
  location: z.string().optional(),
  notes: z.string().optional(),
});

type BookingForm = z.infer<typeof bookingSchema>;

export function BookingForm({ defaultBarberId, isSecondCut, bookingState, hasFreeCutBookedOrCompleted, hasActiveMembership, membershipUsage }: BookingFormProps) {
  const searchParams = useSearchParams();
  const rescheduleId = searchParams.get("reschedule");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rescheduleData, setRescheduleData] = useState<{ barberId: string; plan: string } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [successData, setSuccessData] = useState<{ emailed: boolean; icsUrl?: string; message?: string } | null>(null);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [loadingBarbers, setLoadingBarbers] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState<BarberDaySummary[] | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [nextOpenings, setNextOpenings] = useState<Opening[]>([]);
  const [loadingOpenings, setLoadingOpenings] = useState(false);
  const { data: session, status } = useSession();

  // Determine default plan based on bookingState (server truth, no URL params)
  const getDefaultPlan = (): "standard" | "deluxe" | "trial" => {
    if (isSecondCut) return "standard";
    if (bookingState?.type === "FIRST_FREE") return "trial";
    if (bookingState?.type === "MEMBERSHIP_INCLUDED") return "standard";
    // ONE_OFF: default to standard (plan picker will be shown)
    return "standard";
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      plan: getDefaultPlan(),
      selectedBarber: "", // Will be set after barbers are fetched
    },
  });

  // Lock plan based on bookingState (enforce server truth)
  useEffect(() => {
    if (isSecondCut) {
      setValue("plan", "standard");
    } else if (bookingState?.type === "FIRST_FREE") {
      setValue("plan", "trial");
    } else if (bookingState?.type === "MEMBERSHIP_INCLUDED") {
      setValue("plan", "standard");
    }
  }, [isSecondCut, bookingState, setValue]);

  // Filter available plans based on bookingState (enforce server truth)
  // Hide plan picker for FIRST_FREE and MEMBERSHIP_INCLUDED
  // Show plan picker ONLY for ONE_OFF
  const shouldShowPlanPicker = 
    isSecondCut 
      ? false // Never show for second-cut
      : bookingState?.type === "ONE_OFF"; // Show ONLY for ONE_OFF
  
  const availablePlans = isSecondCut
    ? [] // No plan selection for second-cut
    : shouldShowPlanPicker
    ? PLANS.filter((plan) => {
        // CRITICAL: Never show trial if user already used free cut
        if (plan.id === "trial") {
          return false; // Always hide if hasFreeCutBookedOrCompleted is true (server truth)
        }
        return true; // Always show standard and deluxe
      })
    : []; // Hide plan picker for FIRST_FREE and MEMBERSHIP_INCLUDED

  // Fetch barbers on mount
  useEffect(() => {
    async function fetchBarbers() {
      try {
        setLoadingBarbers(true);
        const response = await fetch("/api/barbers");
        if (response.ok) {
          const data: BarberOption[] = await response.json();
          setBarbers(data);
          // Set default barber if available (exclude disabled and OWNER role)
          const currentBarber = watch("selectedBarber");
          if (!currentBarber) {
            const firstSelectable = data.find((barber) => 
              !isDisabledBarberEmail(barber.email) && barber.role !== "OWNER"
            );
            if (firstSelectable) {
              setValue("selectedBarber", firstSelectable.id);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch barbers:", error);
      } finally {
        setLoadingBarbers(false);
      }
    }
    fetchBarbers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Prefill form from session
  useEffect(() => {
    if (session?.user?.email) {
      setValue("customerEmail", session.user.email);
      if (session.user.name) {
        setValue("customerName", session.user.name);
      }
    }
  }, [session, setValue]);

  // Fetch reschedule data if reschedule param exists
  useEffect(() => {
    async function fetchRescheduleData() {
      if (rescheduleId) {
        try {
          const response = await fetch(`/api/appointments/${rescheduleId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.appointment) {
              const plan = data.appointment.plan === "Free Test Cut" ? "trial" : 
                          data.appointment.plan === "Deluxe" ? "deluxe" : "standard";
              setRescheduleData({
                barberId: data.appointment.barber.id,
                plan
              });
              setValue("selectedBarber", data.appointment.barber.id);
              setValue("plan", plan);
            }
          }
        } catch (error) {
          console.error("Failed to fetch reschedule data:", error);
        }
      } else {
        // Check for barberId in URL params (from reschedule flow)
        const barberIdParam = searchParams.get("barberId");
        if (barberIdParam && barbers.length > 0) {
          setValue("selectedBarber", barberIdParam);
        }
      }
    }
    fetchRescheduleData();
  }, [rescheduleId, searchParams, setValue, barbers]);

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

  // Find the plan object from the selected plan ID
  const currentPlan = PLANS.find((p) => p.id === selectedPlan);
  const isFreeTrial = isFreeTestCut(currentPlan);
  
  // For MEMBERSHIP_INCLUDED, booking is free
  const isMembershipIncluded = bookingState?.type === "MEMBERSHIP_INCLUDED";
  const isFreeBooking = isFreeTrial || isMembershipIncluded;

  // Find selected barber details
  const selectedBarberData = barbers.find((b) => b.id === selectedBarber);
  const selectedBarberCity = selectedBarberData?.city?.trim() || null;

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
          barberId: selectedBarber, // Use barberId instead of barberName
          date: selectedDate,
          plan: isSecondCut ? "standard" : (selectedPlan || ""), // Lock to standard for second-cut
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
  }, [selectedBarber, selectedDate, selectedPlan, isSecondCut, setValue, watch]);

  // Fetch weekly summary when barber changes
  useEffect(() => {
    const fetchWeeklySummary = async () => {
      if (!selectedBarber) {
        setWeeklySummary(null);
        return;
      }

      setLoadingSummary(true);
      try {
        const response = await fetch(`/api/barber/weekly-availability?barberId=${selectedBarber}`);
        if (response.ok) {
          const data = await response.json();
          setWeeklySummary(data.summary || []);
        } else {
          setWeeklySummary([]);
        }
      } catch (error) {
        console.error('Failed to fetch weekly summary:', error);
        setWeeklySummary([]);
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchWeeklySummary();
  }, [selectedBarber]);

  // Fetch next openings when barber or plan changes
  useEffect(() => {
    const fetchNextOpenings = async () => {
      if (!selectedBarber || !selectedPlan) {
        setNextOpenings([]);
        return;
      }

      setLoadingOpenings(true);
      try {
        const response = await fetch(`/api/barber/next-openings?barberId=${selectedBarber}&plan=${selectedPlan}&limit=3`);
        if (response.ok) {
          const data = await response.json();
          setNextOpenings(data.openings || []);
        } else {
          setNextOpenings([]);
        }
      } catch (error) {
        console.error('Failed to fetch next openings:', error);
        setNextOpenings([]);
      } finally {
        setLoadingOpenings(false);
      }
    };

    fetchNextOpenings();
  }, [selectedBarber, selectedPlan, isSecondCut]);

  // Helper to handle day pill click (sets date to next occurrence of that weekday)
  const handleDayPillClick = (dayOfWeek: number) => {
    const nextDate = getNextDateForWeekday(dayOfWeek);
    setValue("selectedDate", nextDate);
  };

  // Helper to check if a day has availability in weekly summary
  const dayHasAvailability = (dayIndex: number): boolean => {
    if (!weeklySummary) return false;
    return weeklySummary.some(day => day.dayIndex === dayIndex);
  };

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
      // Determine the effective plan based on bookingState (enforce server truth)
      // CRITICAL: Fail closed - never allow trial if user already used free cut
      let effectivePlan: "standard" | "deluxe" | "trial";
      if (bookingState?.type === "FIRST_FREE" && !hasFreeCutBookedOrCompleted) {
        effectivePlan = "trial";
      } else if (bookingState?.type === "MEMBERSHIP_INCLUDED") {
        effectivePlan = "standard";
      } else {
        // ONE_OFF: use selected plan, but NEVER allow trial
        effectivePlan = (data.plan === "trial" && hasFreeCutBookedOrCompleted) ? "standard" : data.plan;
      }

      // V1 ENFORCEMENT: Standard/Deluxe are subscription-only.
      // Only DISCOUNT_SECOND is allowed as a one-off payment.
      if (
        bookingState?.type === "ONE_OFF" &&
        (effectivePlan === "standard" || effectivePlan === "deluxe") &&
        !isSecondCut
      ) {
        window.location.href = "/plans";
        setIsSubmitting(false);
        return;
      }
      
      // For trial bookings or membership-included bookings, use direct booking flow
      // (no Stripe payment needed)
      if (effectivePlan === "trial" || bookingState?.type === "MEMBERSHIP_INCLUDED") {
        const idempotencyKey = generateIdempotencyKey();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        
        if (idempotencyKey) {
          headers['idempotency-key'] = idempotencyKey;
        }

        // Convert selectedDate + selectedTime to UTC ISO string
        // IMPORTANT: Interpret date/time as America/Los_Angeles (business timezone)
        const startAtUTCDate = parseLocalDateTimeToUTC(data.selectedDate, data.selectedTime);
        const endAtUTCDate = new Date(startAtUTCDate.getTime() + 30 * 60 * 1000);
        const startAtUTC = startAtUTCDate.toISOString();
        const endAtUTC = endAtUTCDate.toISOString();
        
        // Log for debugging timezone conversion
        if (process.env.NODE_ENV === "development") {
          console.log("[BookingForm] Timezone conversion:", {
            inputDate: data.selectedDate,
            inputTime: data.selectedTime,
            timezone: BUSINESS_TIMEZONE,
            startAtUTC,
            endAtUTC,
          });
        }

        const res = await fetch("/api/bookings", {
          method: "POST",
          headers,
          body: JSON.stringify({
            ...data,
            plan: effectivePlan, // Use the effective plan
            startAtUTC, // Send UTC ISO strings - server will use these
            endAtUTC,
            // Include rescheduleOf if we're rescheduling
            ...(rescheduleId ? { rescheduleOf: rescheduleId } : {}),
          }),
        });

        const result = await res.json().catch(() => ({ ok: false, message: "Failed to parse response" }));

        // IMPORTANT: Check HTTP status FIRST before checking result.ok
        // This ensures we never show "success" when the backend actually failed
        if (!res.ok || result?.ok === false) {
          console.error('[booking] Booking failed', { 
            status: res.status, 
            data: result,
          });

          const code = result?.code;

          // Handle MEMBERSHIP_LIMIT_REACHED with alert
          if (code === "MEMBERSHIP_LIMIT_REACHED") {
            alert(
              result?.error ??
                "You've used all your included cuts for this membership period."
            );
            setIsSubmitting(false);
            return;
          }

          // Handle specific error codes
          let message = "Booking failed. Please try again.";
          if (result?.code === "NO_ACTIVE_MEMBERSHIP") {
            message = "No active membership found. Please subscribe to continue.";
          } else {
            message =
              (result && (result.message || result.error || result.devError)) ||
              (Array.isArray(result?.errors) && result.errors[0]?.message) ||
              "Booking failed. Please try again.";
          }

          setError(message);
          return;
        }

        // Only show success if we got a 2xx status AND the response indicates success
        if (result?.ok !== true && !result.appointmentId) {
          const message =
            (result && (result.message || result.devError)) ||
            "Booking was not created. Please try again.";
          console.error('[booking] Booking response indicates failure', { result });
          setError(message);
          return;
        }

        // IMPORTANT: Only show success banner and redirect if ok is true
        if (result?.ok === true && result.appointmentId) {
          setShowSuccess(true);
          setSuccessData({ 
            emailed: result.emailed, 
            icsUrl: result.icsUrl, 
            message: rescheduleId ? "Appointment rescheduled successfully! Redirecting..." : "Booking confirmed! Redirecting to your appointments..." 
          });
          
          // Redirect to /account after a short delay to show success message
          // This forces a server-side refetch of appointments
          setTimeout(() => {
            window.location.href = rescheduleId ? "/account?rescheduled=1" : "/account?justBooked=1";
          }, 2000);
        } else {
          // This should not happen if checks above work, but be safe
          throw new Error("Booking was not created. Please try again.");
        }
        
        // Reset form
        return;
      }

      // Stripe payment flow (default for paid plans)
      // Convert date/time to UTC ISO strings (interpret as America/Los_Angeles)
      const startAtUTCDate = parseLocalDateTimeToUTC(data.selectedDate, data.selectedTime);
      const endAtUTCDate = new Date(startAtUTCDate.getTime() + 30 * 60 * 1000);
      
      const requestBody = {
        appointmentData: {
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          selectedDate: data.selectedDate,
          selectedTime: data.selectedTime,
          selectedBarber: data.selectedBarber,
          plan: effectivePlan, // Use the effective plan
          location: data.location,
          notes: data.notes,
          startAtUTC: startAtUTCDate.toISOString(), // Send UTC for server
          endAtUTC: endAtUTCDate.toISOString(),
          ...(isSecondCut ? { kind: "DISCOUNT_SECOND" } : {}),
          bookingStateType: bookingState?.type, // Required for backend guard
        }
      };

      // Log request body for DISCOUNT_SECOND debugging
      if (isSecondCut) {
        console.log("[BookingForm][DISCOUNT_SECOND] Sending request to /api/create-checkout-session:", requestBody);
      }

      const checkoutRes = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      // Parse response, handling both JSON and non-JSON errors
      let checkoutResult: any = {};
      try {
        const text = await checkoutRes.text();
        checkoutResult = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error("[BookingForm] Failed to parse checkout response:", parseError);
        throw new Error("Invalid response from payment server");
      }

      if (!checkoutRes.ok) {
        // Extract error message with fallbacks - prioritize stripe_error for DISCOUNT_SECOND
        let errorMessage = checkoutResult.error || `Payment setup failed (${checkoutRes.status})`;
        
        // For DISCOUNT_SECOND, show the actual Stripe error if available
        if (isSecondCut && checkoutResult.stripe_error) {
          errorMessage = `${checkoutResult.error || "Failed to create second-cut payment"}: ${checkoutResult.stripe_error}`;
        } else if (checkoutResult.stripe_error) {
          errorMessage = checkoutResult.stripe_error;
        } else if (checkoutResult.devError) {
          errorMessage = checkoutResult.devError;
        }
        
        console.error("[BookingForm] Checkout failed:", {
          status: checkoutRes.status,
          error: errorMessage,
          stripe_error: checkoutResult.stripe_error,
          stripe_code: checkoutResult.stripe_code,
          fullResponse: checkoutResult,
          isSecondCut,
        });
        
        throw new Error(errorMessage);
      }

      // Redirect to Stripe Checkout
      if (checkoutResult.url) {
        window.location.href = checkoutResult.url;
      } else {
        console.error("[BookingForm] No checkout URL in response:", checkoutResult);
        throw new Error("No checkout URL received from payment server");
      }
      
    } catch (e: any) {
      setError(e?.message || "Failed to submit booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return <div className={laf.page}>Loading...</div>
  }

  return (
    <div className={`${laf.page} ${laf.texture}`}>
      {/* Mobile-first full-width container with responsive max-width */}
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col gap-3 items-center sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="hidden sm:block" />
            <h1 className={laf.h1}>
              {rescheduleId ? "Reschedule Your Cut" : "Book Your Cut"}
            </h1>
            <div className="flex items-center gap-2">
              <SignInButton />
            </div>
          </div>
          <p className={`${laf.sub} text-center sm:text-left`}>
            {rescheduleId && rescheduleData ? (
              <>You&apos;re rescheduling a cut with <span className="font-semibold text-rose-600">{barbers.find(b => b.id === rescheduleData.barberId)?.name || "your stylist"}</span>. Pick a new time below.</>
            ) : (
              "Pick your time — we'll automatically apply the best price for you."
            )}
          </p>
        </header>

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

        {/* State banner based on bookingState */}
        {bookingState && (
          <div className={`${laf.card} ${laf.cardInner} mb-6`}>
            <div className={laf.cardPad}>
              {bookingState.type === "FIRST_FREE" && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎁</span>
                  <div>
                    <p className="text-lg font-semibold text-slate-900">New Year Special: Your first cut is on us!</p>
                    <p className="text-sm text-slate-600">Start the year fresh with a free cut. No card required, no hidden fees — just pick a time and show up.</p>
                  </div>
                </div>
              )}
              {isSecondCut && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎄</span>
                  <div>
                    <p className="text-lg font-semibold text-slate-900">Holiday Special: Your second cut is just $10!</p>
                    <p className="text-sm text-slate-600">Limited time offer: get your second cut at a special price. Perfect way to keep your fresh look going.</p>
                  </div>
                </div>
              )}
              {bookingState.type === "MEMBERSHIP_INCLUDED" && (
                <div className="rounded-2xl bg-white/70 border border-zinc-200 border-dashed px-6 py-4 flex items-start gap-4 mb-6">
                  <div className="mt-0.5 flex-shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1 text-sm">
                    <p className="font-semibold text-emerald-900 tracking-tight mb-1">
                      You&apos;re on the {bookingState.planName ?? "Standard"} membership
                    </p>
                    <p className="text-emerald-800/90 mb-2">
                      This cut is included in your plan. We&apos;ll automatically apply the best price.
                    </p>
                    {membershipUsage && (
                      <p className={`${laf.mono} text-xs text-zinc-700`}>
                        Included cuts this period:{" "}
                        <span className="font-semibold">
                          {membershipUsage.cutsUsed}/{membershipUsage.cutsAllowed}
                        </span>{" "}
                        used ·{" "}
                        <span className="font-semibold">
                          {Math.max(membershipUsage.cutsRemaining, 0)}
                        </span>{" "}
                        remaining
                      </p>
                    )}
                  </div>
                </div>
              )}
              {bookingState.type === "ONE_OFF" && !isSecondCut && (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-lg font-semibold text-slate-900">This is a one-time cut at regular price.</p>
                    <p className="text-sm text-slate-600">
                      You'll pay per cut for this booking. If you want to save and stay fresh every month,{" "}
                      <a href="/plans" className="text-rose-600 hover:text-rose-700 underline font-medium">
                        check the Plans page
                      </a>
                      .
                    </p>
                  </div>
                </div>
              )}
                  </div>
                  </div>
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
                    💡 Try selecting a different time or checking with another stylist.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="mb-6">
          <BookingPortfolioSection barberId={defaultBarberId} />
        </div>

        {/* Main booking form card - full width on mobile */}
        <div className={`${laf.card} ${laf.cardInner} w-full transform transition hover:-translate-y-1`}>
          <div className={laf.cardPad}>
            <form onSubmit={handleSubmit(onSubmit)} className={`space-y-6 ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}>
              {/* Two-column layout on desktop, single column on mobile */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                {/* Left Column - Booking Details */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-rose-500" />
                    Appointment Details
                  </h3>
                  
                  {/* Plan Selection - Hidden for second-cut, show single product card instead */}
                  {isSecondCut ? (
                    <div>
                      <Label className="text-sm font-medium text-zinc-700 mb-2 block">
                        Your Promo
                      </Label>
                      <div className="p-4 rounded-xl border-2 border-rose-300 bg-rose-50/50 shadow-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-semibold text-slate-900">{PRICING.secondCut10.label}</span>
                          <span className="text-[10px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                            PROMO
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">
                          Shop cut, 30 min
                        </p>
                      </div>
                    </div>
                  ) : !isMembershipIncluded ? (
                    <div>
                      <Label htmlFor="plan" className="text-sm font-medium text-zinc-700 mb-2 block">
                        Select Plan *
                      </Label>
                      <div className="space-y-2">
                        {availablePlans.map((plan) => {
                          const isSelected = selectedPlan === plan.id;
                          const isTrial = plan.id === "trial";
                          return (
                            <label
                              key={plan.id}
                              className={`flex items-center space-x-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                                isSelected
                                  ? isTrial
                                    ? "bg-amber-50/80 border-amber-300 shadow-sm"
                                    : "bg-rose-50/50 border-rose-300 shadow-sm"
                                  : "bg-white border-slate-200 hover:border-rose-200 hover:bg-rose-50/30"
                              }`}
                            >
                              <input
                                type="radio"
                                value={plan.id}
                                {...register("plan")}
                                className="text-rose-600 focus:ring-rose-500"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-900">{plan.name}</span>
                                  {isTrial && (
                                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                      FREE
                                    </span>
                                  )}
                                </div>
                                {plan.id === "standard" ? (
                                  <>
                                    <p className="text-sm text-zinc-500">{formatPrice(MEMBERSHIP_STANDARD_PRICE_CENTS)}/month (Shop)</p>
                                    <p className="mt-1 text-xs text-zinc-500">
                                      Up to 2 shop cuts per month — best if you can come to the barber.
                                    </p>
                                  </>
                                ) : plan.id === "deluxe" ? (
                                  <>
                                    <p className="text-sm text-zinc-500">{formatPrice(PRICING.deluxeCut.cents)}/month (Home)</p>
                                    <p className="mt-1 text-xs text-zinc-500">
                                      Up to 2 home visits per month — we come to you.
                                    </p>
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-600">
                                    {formatPrice(PRICING.freeTrial.cents)}/month ({plan.isHome ? "Home" : "Shop"})
                                  </span>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      
                      {/* Trial hint */}
                      {selectedPlan === "trial" && (
                        <div className="mt-2 p-3 bg-amber-50/80 border border-amber-200/50 rounded-xl shadow-sm">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-600" />
                            <div>
                              <p className="text-sm font-medium text-amber-900">
                                First cut free
                              </p>
                              <p className="text-xs text-amber-700 mt-0.5">
                                No payment needed. One free trial per person to try our service!
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {errors.plan && (
                        <p className="text-sm text-red-600 mt-1">{errors.plan.message}</p>
                      )}
                    </div>
                  ) : null}

                  {/* Payment Method Selection: Only for $10 cuts (DISCOUNT_SECOND or ONE_OFF with standard plan) */}
                  {(isSecondCut || (bookingState?.type === "ONE_OFF" && selectedPlan === "standard")) && (
                    <div className="mt-4 space-y-2">
                      <Label className="text-sm font-medium text-zinc-700 mb-2 block">Payment Method</Label>
                      <label className="flex items-start gap-3 rounded-xl border px-3 py-2 cursor-pointer hover:border-zinc-300">
                          <input
                            type="radio"
                          name="paymentMethod"
                          value="STRIPE"
                          checked
                            className="mt-1"
                          />
                          <div className="text-sm">
                          <div className="font-semibold">Pay with Card (Stripe)</div>
                          <div className="text-zinc-600">Secure card payment</div>
                          </div>
                        </label>
                    </div>
                  )}

                  {/* Mini Calendar Strip */}
                  {selectedBarber && weeklySummary && (
                    <div>
                      <Label className="text-sm font-medium text-zinc-700 mb-2 block">
                        Quick pick
                      </Label>
                      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {getNext7Days().map((day) => {
                          const hasAvailability = dayHasAvailability(day.dayIndex);
                          const isSelected = selectedDate === day.date;
                          return (
                            <button
                              key={day.date}
                              type="button"
                              onClick={() => setValue("selectedDate", day.date)}
                              className={`relative flex flex-col items-center justify-center px-3 py-2 rounded-xl border transition-all duration-200 min-w-[70px] ${
                                isSelected
                                  ? "bg-red-600 text-white border-red-600 shadow-sm"
                                  : hasAvailability
                                  ? "bg-white border-zinc-200 hover:bg-zinc-100 focus:ring-2 focus:ring-zinc-900/15"
                                  : "bg-slate-50 border-slate-200/30 opacity-60"
                              } ${day.isToday ? "ring-2 ring-rose-300/50" : ""}`}
                            >
                              {day.isToday && (
                                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
                              )}
                              <span className={`text-xs font-medium ${isSelected ? "text-rose-900" : hasAvailability ? "text-slate-700" : "text-slate-500"}`}>
                                {day.dayName}
                              </span>
                              <span className={`${laf.mono} text-[10px] mt-0.5 ${isSelected ? "text-rose-700" : hasAvailability ? "text-slate-600" : "text-slate-400"}`}>
                                {/* Extract day number directly from YYYY-MM-DD */}
                                {day.date.split("-")[2]}
                              </span>
                              {hasAvailability && (
                                <div className="w-1 h-1 rounded-full bg-rose-400 mt-1" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Date Selection */}
                  <div>
                    <Label htmlFor="selectedDate" className="text-sm font-medium text-zinc-700 mb-2 block flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Select Date *
                    </Label>
                    <Input
                      type="date"
                      {...register("selectedDate")}
                      min={new Date().toISOString().split('T')[0]}
                      className={laf.input}
                    />
                    {errors.selectedDate && (
                      <p className="text-sm text-red-600 mt-1">{errors.selectedDate.message}</p>
                    )}
                    {selectedDate && (() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const todayStr = today.toISOString().split('T')[0];
                      const isToday = selectedDate === todayStr;
                      return isToday ? (
                        <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1">
                          <span>✨</span>
                          <span>You&apos;re booking for today</span>
                        </p>
                      ) : null;
                    })()}
                  </div>

                  {/* Next Openings Banner */}
                  {selectedBarber && (isSecondCut || selectedPlan) && !loadingOpenings && nextOpenings.length > 0 && (
                    <div className="p-3 bg-gradient-to-r from-rose-50/60 to-amber-50/40 border border-rose-200/50 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-rose-600" />
                        <span className="text-xs font-semibold text-slate-900">Next openings</span>
                      </div>
                      <AnimatedList className="gap-1.5">
                        {nextOpenings.map((opening, idx) => (
                          <Pill
                            key={`${opening.date}-${opening.time}`}
                            variant="highlight"
                            onClick={() => {
                              setValue("selectedDate", opening.date);
                              setValue("selectedTime", opening.time);
                            }}
                            className="cursor-pointer hover:scale-105 transition-transform"
                          >
                            <span className="text-[10px]">
                              {formatDateWithDay(opening.date)} · {opening.time}
                            </span>
                          </Pill>
                        ))}
                      </AnimatedList>
                    </div>
                  )}

                  {selectedBarber && (isSecondCut || selectedPlan) && !loadingOpenings && nextOpenings.length === 0 && (
                    <div className="p-3 bg-slate-50/60 border border-slate-200/50 rounded-xl">
                      <p className="text-xs text-slate-600 italic">
                        This stylist has no upcoming openings right now. Try another date or stylist.
                      </p>
                    </div>
                  )}

                  {/* Time Selection */}
                  <div>
                    <Label className="text-sm font-medium text-zinc-700 mb-2 block flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Select Time * {loadingSlots && <span className="text-xs text-zinc-500">(Finding the best time for you...)</span>}
                    </Label>
                    
                    {loadingSlots && selectedBarber && selectedDate ? (
                      <TimeSlotsSkeleton />
                    ) : (
                      <>
                        {availableSlots.length === 0 && selectedBarber && selectedDate && !loadingSlots && (
                          <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg mb-3">
                            No available slots for this stylist and date. Please try another date.
                          </div>
                        )}
                        
                        {/* Time pills - 2 columns on small screens, 3 on larger */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {availableSlots.map((time) => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => setValue("selectedTime", time)}
                              className={`px-3 py-2 rounded-xl border transition-all duration-150 ease-out text-sm font-medium active:scale-95 ${
                                watch("selectedTime") === time
                                  ? "bg-gradient-to-r from-rose-600 to-amber-600 text-white border-transparent shadow-md scale-105"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-rose-300 hover:bg-rose-50/50 hover:scale-105"
                              }`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    
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
                      Select Stylist *
                    </Label>
                    {loadingBarbers ? (
                      <p className="text-sm text-zinc-500">Loading stylists...</p>
                    ) : barbers.length === 0 ? (
                      <p className="text-sm text-amber-600">No stylists available. Please contact support.</p>
                    ) : (
                      <div className="space-y-2">
                        {barbers.map((barber) => {
                          const isDisabled = isDisabledBarberEmail(barber.email);
                          const isOwner = barber.role === "OWNER";
                          const isDisabledOrOwner = isDisabled || isOwner;
                          return (
                            <button
                              key={barber.id}
                              type="button"
                              onClick={() => !isDisabledOrOwner && setValue("selectedBarber", barber.id)}
                              disabled={isDisabledOrOwner}
                              className={`w-full px-4 py-3 rounded-xl border transition-all duration-200 flex items-center gap-2 ${
                                watch("selectedBarber") === barber.id && !isDisabledOrOwner
                                  ? "bg-gradient-to-r from-rose-600 to-amber-600 text-white border-transparent shadow-md"
                                  : isDisabledOrOwner
                                  ? "bg-slate-100 text-slate-400 border-slate-200 opacity-60"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-rose-300 hover:bg-rose-50/50"
                              } ${isDisabledOrOwner ? "cursor-not-allowed pointer-events-none" : ""}`}
                            >
                              <User className="w-4 h-4" />
                              <span className={isDisabledOrOwner ? "text-slate-400" : undefined}>
                                {barber.name || barber.email || ""}
                              </span>
                              {barber.city && !isDisabledOrOwner && (
                                <span className="ml-auto text-xs text-white/80">
                                  {barber.city}
                                </span>
                              )}
                              {isDisabled && (
                                <span className="ml-auto text-xs text-slate-400 font-medium">Unavailable</span>
                              )}
                              {isOwner && !isDisabled && (
                                <span className="ml-auto text-xs text-slate-400 font-medium">Admin</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {errors.selectedBarber && (
                      <p className="text-sm text-red-600 mt-1">{errors.selectedBarber.message}</p>
                    )}

                    {/* Weekly Availability Summary */}
                    {selectedBarber && selectedBarberData && (
                      <div className="mt-4 rounded-2xl border bg-gradient-to-br from-rose-50/40 to-amber-50/20 px-4 py-3 shadow-sm">
                        {selectedBarberCity && (
                          <p className="text-xs font-medium text-rose-600 mb-2">
                            Cuts with {selectedBarberData.name || "your barber"} in {selectedBarberCity}
                          </p>
                        )}
                        {loadingSummary ? (
                          <p className="text-sm text-zinc-500">Loading schedule...</p>
                        ) : weeklySummary && weeklySummary.length > 0 ? (
                          <>
                            <p className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-rose-600" />
                              {(selectedBarberData.name || selectedBarberData.email || "Team member")}&apos;s usual schedule
                            </p>
                            <AnimatedList>
                              {weeklySummary.map((day) =>
                                day.slots.map((slot, i) => (
                                  <Pill
                                    key={`${day.label}-${i}`}
                                    variant="available"
                                    icon={Clock}
                                    onClick={() => handleDayPillClick(day.dayIndex)}
                                    className="cursor-pointer hover:scale-105 transition-transform"
                                  >
                                    <span className="font-medium mr-1">{day.label}</span>
                                    <span className="text-[0.7rem] opacity-80">
                                      {formatTime12Hour(slot.start)}–{formatTime12Hour(slot.end)}
                                    </span>
                                  </Pill>
                                ))
                              )}
                            </AnimatedList>
                          </>
                        ) : (
                          <p className="text-sm text-zinc-600 italic">
                            This stylist hasn&apos;t set weekly hours yet. Try different dates or another stylist.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Location for Deluxe */}
                  {selectedPlan === "deluxe" && (
                    <div>
                      <Label htmlFor="location" className="text-sm font-medium text-zinc-700 mb-2 block flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5" />
                        Home Address *
                      </Label>
                      <Input
                        {...register("location")}
                        placeholder="Enter your home address"
                        className={laf.input}
                      />
                      {errors.location && (
                        <p className="text-sm text-red-600 mt-1">{errors.location.message}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Column - Customer Info */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-rose-500" />
                    Your Information
                  </h3>
                  
                  <div>
                    <Label htmlFor="customerName" className="text-sm font-medium text-zinc-700 mb-2 block flex items-center gap-2">
                      <User className="w-3.5 h-3.5" />
                      Full Name *
                    </Label>
                    <Input
                      {...register("customerName")}
                      placeholder="Enter your full name"
                      className={laf.input}
                    />
                    {errors.customerName && (
                      <p className="text-sm text-red-600 mt-1">{errors.customerName.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="customerEmail" className="text-sm font-medium text-zinc-700 mb-2 block flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" />
                      Email *
                    </Label>
                    <Input
                      type="email"
                      {...register("customerEmail")}
                      placeholder="Enter your email"
                      disabled={!!session?.user?.email}
                      className={laf.input}
                    />
                    {errors.customerEmail && (
                      <p className="text-sm text-red-600 mt-1">{errors.customerEmail.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="customerPhone" className="text-sm font-medium text-zinc-700 mb-2 block flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" />
                      Phone Number *
                    </Label>
                    <Input
                      type="tel"
                      {...register("customerPhone")}
                      placeholder="Enter your phone number"
                      className={laf.input}
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
                      className={laf.input}
                      rows={3}
                      placeholder="Any specific styling preferences or notes..."
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-6 pb-6 md:pb-0">
                <Button
                  type="submit"
                  disabled={isSubmitting || !session}
                  aria-busy={isSubmitting}
                  className="w-full rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white shadow-md hover:shadow-lg transition-all duration-150 ease-out active:scale-95 active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : !session ? (
                    "Sign In to Book"
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirm Booking
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

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
