import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const statusUpdateSchema = z.object({
  status: z.enum(["BOOKED", "CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELED"]),
  reason: z.string().optional() // Changed from cancelReason to reason for simplicity
});

/**
 * PATCH /api/appointments/[id]/status
 * Update appointment status
 * 
 * Auth required: Must be logged in as BARBER (for CONFIRM/COMPLETE/NO_SHOW) or CLIENT (for CANCEL)
 * 
 * Allowed transitions:
 * - BARBER: BOOKED → CONFIRMED → COMPLETED, NO_SHOW, CANCELED
 * - CLIENT: BOOKED | CONFIRMED → CANCELED (within time window, e.g., 24h before)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    // === HEAVY LOGGING ===
    console.log('[appointment/status] PATCH request start', {
      method: req.method,
      appointmentId: params.id,
      hasSession: !!session,
      userId: (session?.user as any)?.id || 'MISSING',
      userRole: (session?.user as any)?.role || 'MISSING',
      userEmail: session?.user?.email || 'MISSING',
    });
    
    if (!session?.user?.email) {
      console.error('[appointment/status] No session');
      return NextResponse.json(
        { ok: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[appointment/status] JSON parse error', parseError);
      return NextResponse.json(
        { ok: false, message: "Invalid request body" },
        { status: 400 }
      );
    }
    
    console.log('[appointment/status] Request body', body);
    
    const validation = statusUpdateSchema.safeParse(body);
    
    if (!validation.success) {
      console.error('[appointment/status] Validation failed', validation.error.issues);
      return NextResponse.json(
        { ok: false, message: "Invalid status", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { status: newStatus, reason } = validation.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    });

    if (!user) {
      console.error('[appointment/status] User not found', { email: session.user.email });
      return NextResponse.json(
        { ok: false, message: "User not found" },
        { status: 404 }
      );
    }

    // Fetch appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        client: { select: { id: true } },
        barber: { select: { id: true } }
      }
    });

    if (!appointment) {
      console.error('[appointment/status] Appointment not found', { appointmentId: params.id });
      return NextResponse.json(
        { ok: false, message: "Appointment not found" },
        { status: 404 }
      );
    }

    // === LOG CURRENT APPOINTMENT STATE ===
    console.log('[appointment/status] Current appointment state', {
      appointmentId: appointment.id,
      currentStatus: appointment.status,
      startAt: appointment.startAt.toISOString(),
      clientId: appointment.clientId,
      barberId: appointment.barberId,
      requestedNewStatus: newStatus,
    });

    // Check permissions and allowed transitions
    const isBarber = user.role === "BARBER" || user.role === "OWNER";
    const isClient = user.role === "CLIENT";
    const isAppointmentBarber = appointment.barberId === user.id;
    const isAppointmentClient = appointment.clientId === user.id;

    // BARBER can update status if they own the appointment
    if (isBarber && isAppointmentBarber) {
      // BARBER can: CONFIRM, COMPLETE, NO_SHOW, CANCEL
      if (!["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELED"].includes(newStatus)) {
        console.error('[appointment/status] Barber invalid status transition', { newStatus });
        return NextResponse.json(
          { ok: false, message: `Barbers cannot set status to ${newStatus}` },
          { status: 403 }
        );
      }
      console.log('[appointment/status] Barber action allowed', { newStatus });
    }
    // CLIENT can only cancel their own appointments
    else if (isClient && isAppointmentClient) {
      if (newStatus !== "CANCELED") {
        console.error('[appointment/status] Client tried non-cancel action', { newStatus });
        return NextResponse.json(
          { ok: false, message: "Clients can only cancel appointments" },
          { status: 403 }
        );
      }
      
      // Check if appointment is in the past
      if (new Date(appointment.startAt) < new Date()) {
        console.error('[appointment/status] Client tried to cancel past appointment');
        return NextResponse.json(
          { ok: false, message: "Cannot cancel past appointments" },
          { status: 400 }
        );
      }
      
      // TEMP BUSINESS RULE FOR LAUNCH: Client can cancel anytime (no 24h restriction)
      console.log('[appointment/status] Client cancel allowed (launch version - no 24h restriction)');
    } else {
      console.error('[appointment/status] Permission denied', {
        isBarber,
        isClient,
        isAppointmentBarber,
        isAppointmentClient,
        userRole: user.role,
      });
      return NextResponse.json(
        { ok: false, message: "You don't have permission to update this appointment" },
        { status: 403 }
      );
    }

    // Update appointment status
    // If canceling and reason provided, append to notes (simpler for launch than separate field)
    const updateData: { status: string; notes?: string } = { status: newStatus };
    if (newStatus === "CANCELED" && reason) {
      const cancelNote = `Client canceled: ${reason}`;
      updateData.notes = appointment.notes 
        ? `${appointment.notes}\n\n${cancelNote}`
        : cancelNote;
    }

    console.log('[appointment/status] Updating appointment', {
      appointmentId: params.id,
      updateData,
    });

    const updated = await prisma.appointment.update({
      where: { id: params.id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        barber: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    console.log('[appointment/status] Appointment updated successfully', {
      appointmentId: updated.id,
      newStatus: updated.status,
    });

    // Format response
    let planName = "Standard";
    if (updated.isFree) {
      planName = "Free Test Cut";
    } else if (updated.type === "HOME") {
      planName = "Deluxe";
    }

    return NextResponse.json({
      ok: true,
      appointment: {
        id: updated.id,
        client: {
          id: updated.client.id,
          name: updated.client.name || updated.client.email || "Client",
          email: updated.client.email
        },
        barber: {
          id: updated.barber.id,
          name: updated.barber.name || updated.barber.email || "Barber",
          email: updated.barber.email
        },
        plan: planName,
        startAt: updated.startAt.toISOString(),
        endAt: updated.endAt.toISOString(),
        status: updated.status,
        type: updated.type,
        address: updated.address,
        notes: updated.notes,
        isFree: updated.isFree
      }
    });
  } catch (error) {
    console.error("[appointment/status] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, message: "Unexpected server error while updating appointment" },
      { status: 500 }
    );
  }
}

