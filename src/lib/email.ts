import { Resend } from 'resend';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';

const resendApiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM;
const ownerEmail = process.env.NOTIFY_TO || '';

const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Safe email sending wrapper - never throws, always logs.
 * Booking should never fail because of email errors.
 */
export async function sendBookingEmailsSafe(appointmentId: string) {
  try {
    console.log('[email] sendBookingEmailsSafe start', { appointmentId });

    if (!resend) {
      console.warn('[email] RESEND_API_KEY is missing - skipping email notifications');
      return;
    }
    if (!fromAddress) {
      console.warn('[email] EMAIL_FROM is missing - skipping email notifications');
      return;
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
      return;
    }
    if (!appt.client) {
      console.error('[email] Appointment.client not loaded', { appointmentId });
      return;
    }
    if (!appt.barber) {
      console.error('[email] Appointment.barber not loaded', { appointmentId });
      return;
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
    console.log('[email] send results', JSON.stringify(results, null, 2));
    console.log('[email] sendBookingEmailsSafe finished', { appointmentId });
  } catch (err) {
    // IMPORTANT: swallow error - do not throw
    console.error('[email] error while sending booking emails', { appointmentId, error: err });
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
 */
export function sendBookingEmailsFireAndForget(appointmentId: string) {
  sendBookingEmailsSafe(appointmentId).catch((err) => {
    console.error('[email] background email error', err);
  });
}
