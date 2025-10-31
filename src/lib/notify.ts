import { Resend } from 'resend'

// Only create Resend client if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

interface AppointmentWithIncludes {
  id: string
  type: "HOME" | "SHOP"
  startAt: Date
  endAt: Date
  status: string
  isFree: boolean
  client: {
    name: string
    email: string
    phone: string
  }
  barber: {
    name: string
  }
  address?: string | null
}

export async function sendBookingEmail(appointment: AppointmentWithIncludes, type: 'created' | 'cancelled' = 'created', icsContent?: string): Promise<{ emailed: boolean; reason?: string }> {
  // Skip email if RESEND_API_KEY not configured
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_FROM || !resend) {
    console.log('Email skipped: RESEND_API_KEY or NOTIFY_FROM not configured')
    return { emailed: false, reason: 'no-resend' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9999"
  const notifyTo = process.env.NOTIFY_TO || "bookings@lefade.com"
  const notifyFrom = process.env.NOTIFY_FROM || "Le Fade <no-reply@lefade.com>"
  
  const date = new Date(appointment.startAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const time = new Date(appointment.startAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  
  const planName = appointment.isFree ? "Free Trial" : 
                  appointment.type === "HOME" ? "Deluxe" : "Standard"
  
  const isCreated = type === 'created'
  
  try {
    // Prepare attachments
    const attachments: any[] = []
    if (icsContent) {
      attachments.push({
        filename: 'appointment.ics',
        content: Buffer.from(icsContent).toString('base64'),
        contentType: 'text/calendar; method=REQUEST',
      })
    }

    // Customer confirmation email
    await resend!.emails.send({
      from: notifyFrom,
      to: [appointment.client.email],
      subject: isCreated ? 
        `Le Fade Booking Confirmed — ${date}!` : 
        `Le Fade Appointment Updated — ${date} ${time}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Le Fade Booking Confirmation</title>
          <style>
            body { font-family: Arial, sans-serif; color: #18181b; background-color: #fafafa; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: #18181b; color: white; padding: 24px; text-align: center; }
            .content { padding: 32px; }
            .booking-details { background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 8px 0; }
            .detail-label { font-weight: 600; }
            .plan-badge { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 14px; font-weight: 600; }
            .plan-standard { background: #f4f4f5; color: #18181b; }
            .plan-deluxe { background: #fef3c7; color: #925a22; }
            .plan-trial { background: #fde68a; color: #92400e; }
            .footer { text-align: center; padding: 20px; color: #71717a; font-size: 14px; }
          </style>
        </head>
        <body>` +
          (icsContent ? `
          <div class="container">
            <div style="padding: 16px; background: #f0f9ff; border-radius: 8px; margin: 20px auto; max-width: 560px; border-left: 4px solid #3b82f6;">
              <p style="margin: 0; font-size: 14px; color: #1e40af;">
                📅 <strong>Calendar invite attached!</strong> Add this appointment to your calendar.
              </p>
            </div>
          </div>` : '') + `
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">Le Fade</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.9;">${isCreated ? 'Booking Confirmed' : 'Appointment Updated'}</p>
            </div>
            <div class="content">
              <h2 style="margin-top: 0;">Hi ${appointment.client.name}!</h2>
              <p>${isCreated ? 'Your appointment has been confirmed.' : 'Your appointment has been updated.'} Here are the details:</p>
              
              <div class="booking-details">
                <div class="detail-row">
                  <span class="detail-label">Service:</span>
                  <span class="plan-badge plan-${planName.toLowerCase().replace(' ', '-')}">${planName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Date:</span>
                  <span>${date}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Time:</span>
                  <span>${time}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Barber:</span>
                  <span>${appointment.barber.name}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Contact:</span>
                  <span>${appointment.client.phone}</span>
                </div>
                ${appointment.type === "HOME" && appointment.address ? 
                  `<div class="detail-row">
                    <span class="detail-label">Address:</span>
                    <span>${appointment.address}</span>
                  </div>` : ''}
              </div>

              <p style="margin-bottom: 0;">
                ${appointment.isFree ? 
                  '🎉 This is your free trial! No payment required.' :
                  'Thank you for choosing Le Fade for your grooming needs.'}
              </p>
            </div>
            <div class="footer">
              <p>Need to make changes? Reply to this email or call us.</p>
              <p><a href="${appUrl}" style="color: #18181b;">Visit Le Fade</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments
    })

    // Internal notification email
    await resend!.emails.send({
      from: notifyFrom,
      to: [notifyTo],
      subject: `${isCreated ? 'New Booking' : 'Booking Update'}: ${appointment.client.name} - ${planName} - ${date} ${time}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>New Booking Alert</title>
          <style>
            body { font-family: Arial, sans-serif; color: #18181b; line-height: 1.6; }
            .booking-card { border: 1px solid #e4e4e7; border-radius: 8px; padding: 20px; margin: 16px 0; }
            .customer-info { background: #f4f4f5; padding: 16px; border-radius: 6px; margin: 12px 0; }
            .appointment-time { font-size: 18px; font-weight: 600; color: #18181b; }
            .plan-type { display: inline-block; padding: 4px 12px; border-radius: 6px; font-weight: 600; margin: 8px 0; }
            .plan-standard { background: #f4f4f5; color: #18181b; }
            .plan-deluxe { background: #fef3c7; color: #925a22; }
            .plan-trial { background: #fde68a; color: #92400e; }
          </style>
        </head>
        <body>
          <h1>${isCreated ? 'New Booking Alert' : 'Booking Update Alert'}</h1>
          
          <div class="booking-card">
            <div class="appointment-time">${date} at ${time}</div>
            <div class="plan-type plan-${planName.toLowerCase().replace(' ', '-')}">${planName}</div>
            
            <div class="customer-info">
              <strong>Customer:</strong> ${appointment.client.name}<br>
              <strong>Email:</strong> ${appointment.client.email}<br>
              <strong>Phone:</strong> ${appointment.client.phone}<br>
              <strong>Barber:</strong> ${appointment.barber.name}<br>
              ${appointment.type === "HOME" && appointment.address ? 
                `<strong>Address:</strong> ${appointment.address}<br>` : ''}
              <strong>Appointment ID:</strong> ${appointment.id}
            </div>
            
            ${appointment.isFree ? '<p><strong>Note:</strong> This is a free trial booking.</p>' : ''}
          </div>
          
          <p>
            <a href="${appUrl}/barber" style="color: #18181b; font-weight: 600;">
              View in Barber Dashboard →
            </a>
          </p>
        </body>
        </html>
      `
    })

    console.log('Booking emails sent successfully')
    return { emailed: true }
  } catch (error) {
    console.error('Failed to send booking emails:', error)
    return { emailed: false }
  }
}
