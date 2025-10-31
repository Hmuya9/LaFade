# 🚨 URGENT: Create Your .env.local File

## Problem
The error `?error=send_failed` happens because your environment variables aren't persisting. Setting them in PowerShell (`$env:VAR=value`) only works for that terminal session.

## Solution: Create .env.local File

**Run this command in PowerShell from the `web/` directory:**

```powershell
@"
# NextAuth Configuration
NEXTAUTH_SECRET=<YOUR_NEXTAUTH_SECRET>
NEXTAUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true

# Resend Email Configuration (Test Mode)
RESEND_API_KEY=<YOUR_RESEND_API_KEY>
EMAIL_FROM=onboarding@resend.dev

# Application Configuration
BARBER_EMAIL=hmuya@uw.edu
DATABASE_URL=file:./dev.db

# Stripe Configuration
STRIPE_SECRET_KEY=<YOUR_STRIPE_SECRET_KEY>
STRIPE_PRICE_SUB=price_12345_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_replace_me

# Notification Email Configuration
NOTIFY_FROM=lafade487@gmail.com
NOTIFY_TO=hmuya@uw.edu

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
"@ | Out-File -FilePath .env.local -Encoding utf8
```

## Verify It Worked

```powershell
# Check the file exists and has content
Get-Content .env.local
```

You should see all the environment variables listed.

## Then Restart Dev Server

```powershell
# Stop the current dev server (Ctrl+C)
# Start it again (no need for $env: variables anymore!)
npm run dev
```

## Why This Fixes the Problem

- ✅ Next.js automatically loads `.env.local` on startup
- ✅ All environment variables persist across restarts
- ✅ Resend API key is available for email sending
- ✅ No more `?error=send_failed`

## Test Authentication

1. Visit `http://localhost:3000/barber/login`
2. Click "Send Magic Link"
3. Check your email (`hmuya@uw.edu`)
4. Click the magic link
5. ✅ You should be redirected to `/barber` dashboard

---

## Alternative: Manual Creation

If the PowerShell command doesn't work, create the file manually:

1. In VS Code, create a new file: `web/.env.local`
2. Paste this content:

```
NEXTAUTH_SECRET=<YOUR_NEXTAUTH_SECRET>
NEXTAUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
RESEND_API_KEY=<YOUR_RESEND_API_KEY>
EMAIL_FROM=onboarding@resend.dev
BARBER_EMAIL=hmuya@uw.edu
DATABASE_URL=file:./dev.db
STRIPE_SECRET_KEY=<YOUR_STRIPE_SECRET_KEY>
STRIPE_PRICE_SUB=price_12345_replace_me
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_replace_me
NOTIFY_FROM=lafade487@gmail.com
NOTIFY_TO=hmuya@uw.edu
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. Save the file
4. Restart `npm run dev`

---

## Security Note

`.env.local` is already in `.gitignore` - it won't be committed to git. This keeps your secrets safe.

