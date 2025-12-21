import { Resend } from 'resend';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';

/**
 * Email environment status and configuration
 */
export type EmailEnvStatus = {
  ok: boolean;
  reason?: string;
  resendApiKey?: string;
  fromEmail?: string;
  notifyFrom?: string;
  notifyTo?: string;
};

/**
 * Centralized email environment validation.
 * Never throws - returns ok: false if env is missing.
 */
export function getEmailEnvStatus(): EmailEnvStatus {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  const notifyFrom = process.env.NOTIFY_FROM;
  const notifyTo = process.env.NOTIFY_TO;

  if (!resendApiKey) {
    console.warn('[email] Email disabled: RESEND_API_KEY missing');
    return {
      ok: false,
      reason: 'RESEND_API_KEY missing',
    };
  }

  if (!emailFrom && !notifyFrom) {
    console.warn('[email] Email disabled: EMAIL_FROM and NOTIFY_FROM both missing');
    return {
      ok: false,
      reason: 'EMAIL_FROM and NOTIFY_FROM both missing',
      resendApiKey,
    };
  }

  // Use NOTIFY_FROM if available, otherwise EMAIL_FROM
  const effectiveFromEmail = notifyFrom ?? emailFrom;

  return {
    ok: true,
    resendApiKey,
    fromEmail: emailFrom,
    notifyFrom: notifyFrom ?? emailFrom,
    notifyTo: notifyTo || undefined,
  };
}

// Initialize Resend client only if env is valid
const emailEnv = getEmailEnvStatus();
const resend = emailEnv.ok && emailEnv.resendApiKey ? new Resend(emailEnv.resendApiKey) : null;
const fromAddress = emailEnv.notifyFrom || emailEnv.fromEmail;
const ownerEmail = emailEnv.notifyTo || '';

/**
 * Email result type for consistent return values
 */
export type EmailResult = {
  emailed: boolean;
  reason?: string;
};

/**
 * Safe email sending wrapper - never throws, always logs.
 * Booking should never fail because of email errors.
 * Returns EmailResult for consistency.
 */
export async function sendBookingEmailsSafe(appointmentId: string): Promise<EmailResult> {
  try {
    console.log('[email] sendBookingEmailsSafe start', { appointmentId });

    // Check env status first
    const envStatus = getEmailEnvStatus();
    if (!envStatus.ok) {
      console.warn('[email] Email env check failed:', envStatus.reason);
      return { emailed: false, reason: envStatus.reason };
    }

    if (!resend) {
      console.warn('[email] Resend client not initialized - skipping email notifications');
      return { emailed: false, reason: 'Resend client not initialized' };
    }
    if (!fromAddress) {
      console.warn('[email] From address missing - skipping email notifications');
      return { emailed: false, reason: 'From address missing' };
    }

    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        client: true,
        barber: true,
      },
    });

    if (!appt) {
      console.error('[email] Appointment not found', { appointmentId });
      return { emailed: false, reason: 'Appointment not found' };
    }
    if (!appt.client) {
      console.error('[email] Appointment.client not loaded', { appointmentId });
      return { emailed: false, reason: 'Appointment.client not loaded' };
    }
    if (!appt.barber) {
      console.error('[email] Appointment.barber not loaded', { appointmentId });
      return { emailed: false, reason: 'Appointment.barber not loaded' };
    }

    const when = format(appt.startAt, 'EEE, MMM d • h:mm a');

    const clientEmail = appt.client.email;
    const barberEmail = appt.barber.email;

    console.log('[email] resolved emails', { 
      clientEmail, 
      barberEmail, 
      ownerEmail,
      appointmentId: appt.id,
      appointmentStatus: appt.status,
      clientId: appt.client.id,
      barberId: appt.barber.id
    });

    const baseHtml = (body: string) =>
      `<div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5;">
        ${body}
        <p style="margin-top:16px;font-size:12px;color:#6b7280;">
          Manage your cut from your LaFade dashboard.
        </p>
      </div>`;

    const promises: Promise<any>[] = [];

    if (clientEmail) {
      promises.push(
        resend.emails.send({
          from: fromAddress,
          to: clientEmail,
          subject: 'Your LaFade cut is booked ✂️',
          html: baseHtml(
            `<h1 style="font-size:20px;margin-bottom:8px;">Your cut is locked in ✂️</h1>
             <p>Barber: <strong>${appt.barber.name ?? 'Your barber'}</strong></p>
             <p>Time: <strong>${when}</strong></p>`
          ),
        }).catch((err) => {
          console.error('[email] Failed to send client email', { appointmentId, error: err });
        })
      );
    }

    if (barberEmail) {
      promises.push(
        resend.emails.send({
          from: fromAddress,
          to: barberEmail,
          subject: 'New LaFade booking 💈',
          html: baseHtml(
            `<h1 style="font-size:20px;margin-bottom:8px;">You have a new client</h1>
             <p>Client: <strong>${appt.client.name ?? appt.client.email}</strong></p>
             <p>Time: <strong>${when}</strong></p>`
          ),
        }).catch((err) => {
          console.error('[email] Failed to send barber email', { appointmentId, error: err });
        })
      );
    }

    if (ownerEmail) {
      promises.push(
        resend.emails.send({
          from: fromAddress,
          to: ownerEmail,
          subject: `New LaFade booking: ${appt.client.name ?? appt.client.email} → ${
            appt.barber.name ?? 'Barber'
          }`,
          html: baseHtml(
            `<p>Client: <strong>${appt.client.name ?? appt.client.email}</strong></p>
             <p>Barber: <strong>${appt.barber.name ?? 'Barber'}</strong></p>
             <p>Time: <strong>${when}</strong></p>`
          ),
        }).catch((err) => {
          console.error('[email] Failed to send owner email', { appointmentId, error: err });
        })
      );
    }

    const results = await Promise.allSettled(promises);
    
    // Check if any emails failed
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      console.error('[email] Some emails failed to send', { 
        appointmentId, 
        failedCount: failed.length,
        totalCount: results.length 
      });
      return { 
        emailed: false, 
        reason: `${failed.length} of ${results.length} emails failed` 
      };
    }

    console.log('[email] All emails sent successfully', { appointmentId, count: results.length });
    return { emailed: true };
  } catch (err) {
    // IMPORTANT: swallow error - do not throw
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[email] error while sending booking emails', { appointmentId, error: errorMessage });
    return { emailed: false, reason: `Exception: ${errorMessage}` };
  }
}

/**
 * Debug version: throws on problems and logs all results.
 * Call this with `await` while debugging.
 * @deprecated Use sendBookingEmailsSafe for production
 */
export async function sendBookingEmailsDebug(appointmentId: string) {
  console.log('[email] sendBookingEmailsDebug start', { appointmentId });

  if (!resend) {
    console.error('[email] RESEND_API_KEY is missing');
    throw new Error('RESEND_API_KEY is missing');
  }
  if (!fromAddress) {
    console.error('[email] EMAIL_FROM is missing');
    throw new Error('EMAIL_FROM is missing');
  }

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      client: true,
      barber: true,
    },
  });

  if (!appt) throw new Error('Appointment not found');
  if (!appt.client) throw new Error('Appointment.client not loaded');
  if (!appt.barber) throw new Error('Appointment.barber not loaded');

  const when = format(appt.startAt, 'EEE, MMM d • h:mm a');

  const clientEmail = appt.client.email;
  const barberEmail = appt.barber.email;

  console.log('[email] resolved emails', { 
    clientEmail, 
    barberEmail, 
    ownerEmail,
    appointmentId: appt.id,
    appointmentStatus: appt.status,
    clientId: appt.client.id,
    barberId: appt.barber.id
  });

  const baseHtml = (body: string) =>
    `<div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5;">
      ${body}
      <p style="margin-top:16px;font-size:12px;color:#6b7280;">
        Manage your cut from your LaFade dashboard.
      </p>
    </div>`;

  const promises: Promise<any>[] = [];

  if (clientEmail) {
    promises.push(
      resend.emails.send({
        from: fromAddress,
        to: clientEmail,
        subject: 'Your LaFade cut is booked ✂️',
        html: baseHtml(
          `<h1 style="font-size:20px;margin-bottom:8px;">Your cut is locked in ✂️</h1>
           <p>Barber: <strong>${appt.barber.name ?? 'Your barber'}</strong></p>
           <p>Time: <strong>${when}</strong></p>`
        ),
      })
    );
  }

  if (barberEmail) {
    promises.push(
      resend.emails.send({
        from: fromAddress,
        to: barberEmail,
        subject: 'New LaFade booking 💈',
        html: baseHtml(
          `<h1 style="font-size:20px;margin-bottom:8px;">You have a new client</h1>
           <p>Client: <strong>${appt.client.name ?? appt.client.email}</strong></p>
           <p>Time: <strong>${when}</strong></p>`
        ),
      })
    );
  }

  if (ownerEmail) {
    promises.push(
      resend.emails.send({
        from: fromAddress,
        to: ownerEmail,
        subject: `New LaFade booking: ${appt.client.name ?? appt.client.email} → ${
          appt.barber.name ?? 'Barber'
        }`,
        html: baseHtml(
          `<p>Client: <strong>${appt.client.name ?? appt.client.email}</strong></p>
           <p>Barber: <strong>${appt.barber.name ?? 'Barber'}</strong></p>
           <p>Time: <strong>${when}</strong></p>`
        ),
      })
    );
  }

  const results = await Promise.allSettled(promises);
  console.log('[email] send results', JSON.stringify(results, null, 2));
}

/**
 * Non-blocking version for production (keeps booking fast).
 * Returns immediately, logs errors in background.
 */
export function sendBookingEmailsFireAndForget(appointmentId: string): void {
  sendBookingEmailsSafe(appointmentId).catch((err) => {
    console.error('[email] background email error', { appointmentId, error: err });
  });
}

/**
 * Send admin alert email when a new booking is created.
 * Safe wrapper - never throws, always logs errors.
 * 
 * @param clientName - Client's name
 * @param barberName - Barber's name
 * @param time - Formatted appointment time string (e.g., "Mon, Dec 20 • 2:30 PM")
 * @param appointmentKind - Appointment kind: "TRIAL_FREE" | "DISCOUNT_SECOND" | "MEMBERSHIP_INCLUDED" | null (ONE_OFF)
 * @returns EmailResult indicating success/failure
 */
export async function sendAdminBookingAlert(
  clientName: string,
  barberName: string,
  time: string,
  appointmentKind: "TRIAL_FREE" | "DISCOUNT_SECOND" | "MEMBERSHIP_INCLUDED" | null
): Promise<EmailResult> {
  try {
    // Check env status first
    const envStatus = getEmailEnvStatus();
    if (!envStatus.ok) {
      console.warn('[email] Admin alert skipped: Email env check failed:', envStatus.reason);
      return { emailed: false, reason: envStatus.reason };
    }

    if (!resend) {
      console.warn('[email] Admin alert skipped: Resend client not initialized');
      return { emailed: false, reason: 'Resend client not initialized' };
    }
    if (!fromAddress) {
      console.warn('[email] Admin alert skipped: From address missing');
      return { emailed: false, reason: 'From address missing' };
    }

    // Get admin email from env (fallback allowed per requirements)
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.warn('[email] Admin alert skipped: ADMIN_EMAIL not set');
      return { emailed: false, reason: 'ADMIN_EMAIL not set' };
    }

    // Format appointment kind for display
    let kindDisplay = "Standard";
    if (appointmentKind === "TRIAL_FREE") {
      kindDisplay = "Free Test Cut";
    } else if (appointmentKind === "DISCOUNT_SECOND") {
      kindDisplay = "$10 Second Cut";
    } else if (appointmentKind === "MEMBERSHIP_INCLUDED") {
      kindDisplay = "Membership Included";
    }

    const subject = `🔔 New Booking: ${clientName} with ${barberName}`;
    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5;">
        <h1 style="font-size:20px;margin-bottom:16px;">New Booking Alert</h1>
        <p><strong>Client:</strong> ${clientName}</p>
        <p><strong>Barber:</strong> ${barberName}</p>
        <p><strong>Time:</strong> ${time}</p>
        <p><strong>Type:</strong> ${kindDisplay}</p>
        <p style="margin-top:16px;font-size:12px;color:#6b7280;">
          View all appointments in the admin dashboard.
        </p>
      </div>
    `;

    const result = await resend.emails.send({
      from: fromAddress,
      to: adminEmail,
      subject,
      html,
    });

    if ((result as any)?.error) {
      const errorMessage = (result as any).error.message || String((result as any).error);
      console.error('[email] Admin alert failed', { error: errorMessage });
      return { emailed: false, reason: `Resend API error: ${errorMessage}` };
    }

    console.log('[email] Admin alert sent successfully', { adminEmail });
    return { emailed: true };
  } catch (err) {
    // IMPORTANT: swallow error - do not throw
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[email] Admin alert error', { error: errorMessage });
    return { emailed: false, reason: `Exception: ${errorMessage}` };
  }
}
