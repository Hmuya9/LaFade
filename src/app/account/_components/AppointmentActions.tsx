"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SimpleModal } from "@/components/ui/SimpleModal";

export function useAppointmentActions() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelAppointmentId, setCancelAppointmentId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const handleCancel = async (appointmentId: string) => {
    // Open modal to get cancel reason
    setCancelAppointmentId(appointmentId);
    setCancelReason("");
    setShowCancelModal(true);
  };

  const [cancelError, setCancelError] = useState<string | null>(null);

  const confirmCancel = async () => {
    if (!cancelAppointmentId) return;

    setCancelError(null);
    try {
      setLoading(cancelAppointmentId);
      const response = await fetch(`/api/appointments/${cancelAppointmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: "CANCELED",
          reason: cancelReason.trim() || undefined
        })
      });

      const data = await response.json().catch(() => ({ ok: false, message: "Failed to parse response" }));

      if (!response.ok || data?.ok === false) {
        const errorMessage = data?.message || data?.error || "Failed to cancel appointment";
        setCancelError(errorMessage);
        console.error('[cancel] API error', { status: response.status, data });
        return;
      }

      // Success - close modal and refresh
      setShowCancelModal(false);
      setCancelAppointmentId(null);
      setCancelReason("");
      router.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to cancel appointment";
      setCancelError(errorMessage);
      console.error('[cancel] Unexpected error', error);
    } finally {
      setLoading(null);
    }
  };

  const handleReschedule = async (appointmentId: string) => {
    // For reschedule, just navigate - the booking API will handle canceling the old appointment
    // No need to cancel first, reschedule flow handles it in a transaction
    try {
      setLoading(appointmentId);
      const appointmentResponse = await fetch(`/api/appointments/${appointmentId}`);
      
      if (!appointmentResponse.ok) {
        throw new Error("Failed to fetch appointment details");
      }

      const appointmentData = await appointmentResponse.json();
      const barberId = appointmentData.appointment.barber.id;

      // Navigate to booking page with reschedule flag and barber ID
      // The booking API will handle canceling the old appointment in a transaction
      router.push(`/booking?reschedule=${appointmentId}&barberId=${barberId}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to reschedule appointment");
      setLoading(null);
    }
  };

  return {
    handleCancel,
    handleReschedule,
    loading,
    showCancelModal,
    setShowCancelModal,
    cancelReason,
    setCancelReason,
    confirmCancel,
    cancelError
  };
}

