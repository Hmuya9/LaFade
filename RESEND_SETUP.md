# Resend Email Setup for LaFade

## Current Setup (Testing Only)

The app is currently configured with Resend's test sender which **only delivers emails to your Resend account email**.

### `.env.local` Configuration
```bash
RESEND_API_KEY=<YOUR_RESEND_API_KEY>  # Your Resend API key
EMAIL_FROM=onboarding@resend.dev      # Resend's test sender
```

### Testing Limitations
- ✅ Works: Sending to `hmuya@uw.edu` (your Resend account email)
- ❌ Fails: Sending to any other email address
- **Error message**: "You can only send testing emails to your own email address"

This is **expected behavior** for test mode. To send to any email, follow the production setup below.

---

## Production Setup (Send to Any Email)

### Step 1: Buy a Domain (if you don't have one)

You need a domain you control. Options:
- **Cloudflare Registrar** (recommended, cheap)
- Namecheap
- Porkbun
- GoDaddy
- etc.

Example: `lafade.com`

⚠️ **Important**: You cannot use `uw.edu` or any domain you don't own.

### Step 2: Add and Verify Domain in Resend

1. Go to [Resend Dashboard → Domains](https://resend.com/domains)
2. Click **"Add domain"**
3. Enter a subdomain for sending (recommended):
   - ✅ Good: `mail.lafade.com` (protects your main domain reputation)
   - ⚠️ Also works: `lafade.com` (root domain)
4. Resend will show DNS records like:

```
Type: TXT
Name: @
Value: resend-domain-verification=abc123xyz...

Type: MX
Name: @
Value: feedback-smtp.resend.com

Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none...

Type: TXT
Name: resend._domainkey
Value: v=DKIM1; k=rsa; p=...

Type: CNAME
Name: em._domainkey
Value: em._domainkey.resend.com
```

5. **Copy these records exactly** into your DNS provider (Cloudflare, Namecheap, etc.)
6. Wait a few minutes (up to 1 hour for DNS propagation)
7. Click **"Verify"** in Resend

### Step 3: Create API Key

1. Go to [Resend Dashboard → API Keys](https://resend.com/api-keys)
2. Click **"Create API Key"**
3. Select **"Sending access"**
4. Copy the key (starts with `re_...`)

### Step 4: Update Environment Variables

In `web/.env.local`:

```bash
# Resend Configuration (Production)
RESEND_API_KEY=re_************************  # Your new API key
EMAIL_FROM=no-reply@mail.lafade.com         # Your verified domain/subdomain
```

**Examples of valid `EMAIL_FROM` values:**
- `no-reply@mail.lafade.com` (if you verified `mail.lafade.com`)
- `hello@lafade.com` (if you verified root domain `lafade.com`)
- `booking@lafade.com`
- `noreply@lafade.com`

**Note**: You don't need to create an actual email inbox for these addresses unless you want to receive replies.

### Step 5: Restart the App

```bash
# Stop the dev server (Ctrl+C)
cd web
npm run dev
```

### Step 6: Test

1. Visit `http://localhost:3000/client/login`
2. Enter **any email address** (not just `hmuya@uw.edu`)
3. Click "Send Magic Link"
4. Check the recipient's inbox
5. ✅ Email should arrive from your custom domain

---

## Verification Checklist

### DNS Records Added?
- [ ] TXT record for domain verification
- [ ] MX record for bounces/feedback
- [ ] DMARC TXT record
- [ ] DKIM CNAME records

### Resend Dashboard Shows "Verified"?
- [ ] Domain status is **green/verified**
- [ ] Test send works from Resend dashboard

### Environment Variables Updated?
- [ ] `RESEND_API_KEY` has your production API key
- [ ] `EMAIL_FROM` uses your verified domain
- [ ] Dev server restarted after changes

### Test Email Sent Successfully?
- [ ] Non-barber email receives magic link
- [ ] Email shows your custom "From" address
- [ ] Magic link redirects correctly

---

## Common Issues

### "Domain not verified"
- **Solution**: Wait longer (up to 1 hour) for DNS propagation
- Check DNS records are **exact matches** of what Resend shows
- Use a DNS checker tool to verify records are live

### "Invalid API key"
- **Solution**: Make sure you copied the **entire** key from Resend
- Regenerate a new key if needed
- Check for extra spaces in `.env.local`

### "You can only send to your own email"
- **Solution**: You're still using `onboarding@resend.dev`
- Update `EMAIL_FROM` to your verified domain
- Restart dev server

### "Failed to send email"
- **Solution**: Check Resend dashboard logs for specific error
- Verify domain is still showing as verified
- Check API key hasn't been revoked

---

## Current Status

✅ Authentication system is working
✅ Forms submit correctly  
✅ Magic links are generated
✅ Email sending works (to authorized addresses)
⚠️ Currently limited to test mode (one recipient)

**Next step**: Follow production setup above to send to any email address.

---

## For Production Deployment (Vercel)

When deploying to Vercel:

1. Add environment variables in Vercel dashboard:
   ```
   RESEND_API_KEY=re_************************
   EMAIL_FROM=no-reply@mail.lafade.com
   NEXTAUTH_URL=https://yourdomain.com
   NEXTAUTH_SECRET=<generate-new-secret-for-prod>
   AUTH_TRUST_HOST=true
   ```

2. Redeploy the application

3. Test magic link flow on production URL

---

## Support

- Resend Documentation: https://resend.com/docs
- Resend Domain Verification: https://resend.com/docs/dashboard/domains/introduction
- DNS Propagation Checker: https://dnschecker.org

