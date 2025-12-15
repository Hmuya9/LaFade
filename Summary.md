Summary
Files Modified
web/src/lib/email.ts — Replaced with debug version
sendBookingEmailsDebug(): throws on errors, logs all steps
sendBookingEmailsFireAndForget(): non-blocking wrapper for production
Logs: appointment lookup, email resolution, send results
web/src/app/api/bookings/route.ts
Updated import: sendBookingEmailsDebug instead of sendBookingEmails
Changed to await sendBookingEmailsDebug(appointment.id) for debugging
Wrapped in try/catch so booking still succeeds if emails fail
Updated appointment query to include barber.email in select
What the Debug Version Does
Throws errors if:
RESEND_API_KEY is missing
EMAIL_FROM is missing
Appointment not found
Client/barber relations not loaded
Logs:
Start of function with appointment ID
Resolved email addresses (client, barber, owner)
Full send results (JSON) for all 3 emails
Environment Variables Required
Set these in your .env file:
RESEND_API_KEY=re_xxxxx              # Your Resend API key
EMAIL_FROM=no-reply@yourdomain.com  # Sender email (must be verified in Resend)
NOTIFY_TO=your-email@example.com     # Owner/admin email (optional)
Where It's Hooked In
In web/src/app/api/bookings/route.ts, after appointment creation (around line 447-454):
// TEMPORARY for debugging: await to see errors
try {
  await sendBookingEmailsDebug(appointment.id);
  console.log('[booking] Email notifications sent successfully', { appointmentId: appointment.id });
} catch (emailError) {
  console.error('[booking] Email notification error (booking still succeeded):', emailError);
  // Don't fail the booking - emails are non-critical
}
How to Test
Restart your dev server:
# Stop current server (Ctrl+C)
pnpm dev
```

2. Create a test booking via the booking form

3. Watch the console logs:
- `[email] sendBookingEmailsDebug start { appointmentId: "..." }`
- `[email] resolved emails { clientEmail: "...", barberEmail: "...", ownerEmail: "..." }`
- `[email] send results [...]` (full JSON of all email send attempts)

4. If errors occur, you'll see:
- `[email] RESEND_API_KEY is missing` → Set `RESEND_API_KEY` in `.env`
- `[email] EMAIL_FROM is missing` → Set `EMAIL_FROM` in `.env`
- `[email] Appointment not found` → Check appointment ID
- Resend API errors → Check API key validity and domain verification

### Test Email Addresses

The emails will be sent to:
- Client: The email from the booking form (or session user email)
- Barber: The barber's email from the User table (`barber.email`)
- Owner: The email in `NOTIFY_TO` env var (or empty string if not set)

You can check these in Prisma Studio:
```bash
pnpm prisma studio
```

Look at the `User` table to see:
- Client users (role = "CLIENT") and their emails
- Barber users (role = "BARBER") and their emails

The debug version will show all errors and logs, making it easy to identify configuration issues.
Create a test booking via the booking form
Watch the console logs:
[email] sendBookingEmailsDebug start { appointmentId: "..." }
[email] resolved emails { clientEmail: "...", barberEmail: "...", ownerEmail: "..." }
[email] send results [...] (full JSON of all email send attempts)
If errors occur, you'll see:
[email] RESEND_API_KEY is missing → Set RESEND_API_KEY in .env
[email] EMAIL_FROM is missing → Set EMAIL_FROM in .env
[email] Appointment not found → Check appointment ID
Resend API errors → Check API key validity and domain verification
Test Email Addresses
The emails will be sent to:
Client: The email from the booking form (or session user email)
Barber: The barber's email from the User table (barber.email)
Owner: The email in NOTIFY_TO env var (or empty string if not set)
You can check these in Prisma Studio:
pnpm prisma studio
Look at the User table to see:
Client users (role = "CLIENT") and their emails
Barber users (role = "BARBER") and their emails
The debug version will show all errors and logs, making it easy to identify configuration issues.