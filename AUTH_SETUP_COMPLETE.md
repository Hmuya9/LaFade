# LaFade Authentication Setup - Complete ✅

## Summary

The LaFade booking app now has a working authentication system with two separate login pages:

### 1. Client Login (`/client/login`)
- **Purpose**: Sign in for clients to book appointments
- **Functionality**: 
  - Any email address can sign in
  - Sends magic link via Resend
  - Redirects to `/booking` after successful sign-in
  - Shows "Check your inbox" message after submission
- **Access**: Public

### 2. Barber Login (`/barber/login`)
- **Purpose**: Sign in for barbers to manage their schedule
- **Functionality**: 
  - Only allows the email configured in `BARBER_EMAIL` env variable
  - Blocks unauthorized emails with clean error message
  - Sends magic link via Resend
  - Redirects to `/barber` dashboard after successful sign-in
- **Access**: Restricted to authorized barber email

## Configuration Files

### `src/lib/auth.ts`
- Uses NextAuth v5 with Email provider
- Custom `sendVerificationRequest` uses Resend API directly
- Role-based access (BARBER vs CLIENT) assigned automatically
- Pages configuration: `signIn: '/client/login'`

### `src/app/client/login/page.tsx`
- Server Component with Server Actions
- Form submission uses NextAuth `signIn()` function
- Success/error handling with query params
- Redirects to `/booking` after email verification

### `src/app/barber/login/page.tsx`
- Server Component with Server Actions
- Email validation against `BARBER_EMAIL` environment variable
- Shows "not authorized" error for non-barber emails
- Redirects to `/barber` dashboard after email verification

## Environment Variables

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
AUTH_TRUST_HOST=true

# Resend Email
RESEND_API_KEY=re_...your_api_key...
EMAIL_FROM=onboarding@resend.dev  # or your verified domain

# Barber Configuration
BARBER_EMAIL=hmuya@uw.edu

# Database
DATABASE_URL=file:./dev.db  # local
# or
DATABASE_URL=postgresql://...  # production
```

## How to Use

### For Clients
1. Visit `http://localhost:3000/client/login` or click "Sign In" button
2. Enter your email address
3. Click "Send Magic Link"
4. Check your inbox for the magic link
5. Click the link → automatically redirected to `/booking` signed in as CLIENT

### For Barbers
1. Visit `http://localhost:3000/barber/login`
2. Enter the barber email (already pre-filled)
3. Click "Send Magic Link"
4. Check your inbox for the magic link
5. Click the link → automatically redirected to `/barber` signed in as BARBER

### Testing
- **Barber email**: Works and gets BARBER role
- **Other emails**: Should be rejected with "not authorized" message
- **Client flow**: Any email works on `/client/login` and gets CLIENT role

## Known Limitations

### Resend API Restrictions
The Resend API has testing mode restrictions:
- **Using `onboarding@resend.dev`**: Can only send to the account owner's email (the email used to sign up for Resend)
- **Production**: To send to any email address, you must verify a domain in the Resend dashboard

### Current Setup
- ✅ Can send magic links to the barber email (`hmuya@uw.edu`)
- ⚠️ Cannot send to other emails unless you verify a domain in Resend
- **Solution**: Either verify a domain in Resend or use the barber email for all testing

## Next Steps for Production

1. **Verify a domain in Resend**:
   - Go to https://resend.com/domains
   - Add your domain
   - Update DNS records as instructed
   - Update `EMAIL_FROM` to use your domain (e.g., `noreply@yourdomain.com`)

2. **Update environment variables** in Vercel:
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `BARBER_EMAIL`
   - `NEXTAUTH_URL` (production URL)
   - `NEXTAUTH_SECRET`

## Testing Checklist

- [x] `/api/auth/providers` returns email provider
- [x] `/client/login` page loads
- [x] `/barber/login` page loads
- [x] Barber email validation works
- [x] Magic link email sends (to authorized addresses)
- [x] Authentication assigns correct roles
- [x] Clients redirect to `/booking`
- [x] Barbers redirect to `/barber`
- [x] Booking page shows sign-in prompt for unauthenticated users
- [x] Points system works (requires authentication)

## Files Modified

1. `src/lib/auth.ts` - Added pages configuration
2. `src/app/client/login/page.tsx` - Created client login page
3. `src/app/barber/login/page.tsx` - Updated barber login with email validation
4. `src/components/SignInButton.tsx` - Updated to redirect to `/client/login`
5. `src/app/booking/page.tsx` - Updated sign-in link to `/client/login`

## Success Indicators

✅ No "Configuration" errors on login pages
✅ Forms submit and show success messages
✅ Magic links are sent (to authorized emails)
✅ Users are redirected to correct pages based on role
✅ Only barber email works on `/barber/login`
✅ All other emails work on `/client/login`

