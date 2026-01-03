# Pause Site Implementation

## Overview
This implementation allows you to safely pause LaFade production on Vercel by showing a holding page to all visitors while keeping webhooks/cron jobs active.

## Files Changed

### 1. `web/src/middleware.ts`
- Added pause site logic at the very beginning of middleware
- Checks `PAUSE_SITE` environment variable
- Allows bypass via query param `?bypass=<token>` or cookie `pause_bypass=1`
- Always allows: `/pause`, `/api/**`, `/_next/**`, `/favicon.ico`, `/robots.txt`, `/sitemap.xml`
- Redirects everything else to `/pause` with 307 (temporary redirect)

### 2. `web/src/app/pause/page.tsx`
- New holding page route
- Shows "We're Temporarily Paused" message
- "Join Waitlist" CTA (placeholder link)
- Displays bypass status if enabled
- Redirects to home if `PAUSE_SITE` is not enabled

## Environment Variables

### Required for Vercel:

1. **PAUSE_SITE**
   - Value: `true` (to enable pause) or `false`/unset (to disable)
   - Type: Environment Variable
   - Scope: Production (and Preview if desired)

2. **PAUSE_BYPASS_TOKEN**
   - Value: A long random string (e.g., generate with: `openssl rand -hex 32`)
   - Type: Environment Variable
   - Scope: Production (and Preview if desired)
   - Example: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`

### How to Set on Vercel:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add:
   - `PAUSE_SITE` = `true`
   - `PAUSE_BYPASS_TOKEN` = `<your-random-token>`
4. Redeploy (or wait for next deployment)

## Usage

### Enable Pause:
1. Set `PAUSE_SITE=true` in Vercel
2. Redeploy or wait for next deployment
3. All visitors (except those with bypass) will see `/pause` page

### Disable Pause:
1. Set `PAUSE_SITE=false` or remove the variable
2. Redeploy or wait for next deployment
3. Site returns to normal operation

### Bypass (Owner Access):
1. Visit: `https://yourdomain.com?bypass=<PAUSE_BYPASS_TOKEN>`
2. Cookie `pause_bypass=1` will be set automatically (30 days)
3. You can now access the full site
4. The `/pause` page will show "Bypass enabled" status

## Testing

### Local Testing:

1. **Test with pause enabled:**
   ```bash
   # In your .env.local or terminal
   export PAUSE_SITE=true
   export PAUSE_BYPASS_TOKEN=test-token-123
   
   # Start dev server
   npm run dev
   ```

2. **Test scenarios:**
   - Visit `http://localhost:3000/` → Should redirect to `/pause`
   - Visit `http://localhost:3000/booking` → Should redirect to `/pause`
   - Visit `http://localhost:3000/api/health` → Should work (API allowed)
   - Visit `http://localhost:3000/pause` → Should show pause page
   - Visit `http://localhost:3000/?bypass=test-token-123` → Should bypass and show home page
   - Visit `http://localhost:3000/pause?bypass=test-token-123` → Should show pause page with "Bypass enabled"

3. **Test with pause disabled:**
   ```bash
   # Remove or set to false
   export PAUSE_SITE=false
   # or unset PAUSE_SITE
   ```
   - All routes should work normally

### Production Testing (Vercel):

1. **Before enabling:**
   - Test bypass token generation
   - Note your bypass URL: `https://yourdomain.com?bypass=<token>`

2. **Enable pause:**
   - Set `PAUSE_SITE=true` in Vercel
   - Deploy or wait for deployment

3. **Verify:**
   - Visit `https://yourdomain.com` → Should show pause page
   - Visit `https://yourdomain.com/booking` → Should redirect to pause page
   - Visit `https://yourdomain.com/api/health` → Should work (API)
   - Visit `https://yourdomain.com?bypass=<token>` → Should bypass

4. **Disable when ready:**
   - Set `PAUSE_SITE=false` or remove variable
   - Redeploy

## Safety Features

✅ **No redirect loops**: `/pause` is explicitly allowed, so redirects won't loop  
✅ **API routes protected**: All `/api/**` routes continue working (webhooks, cron)  
✅ **Static assets work**: `/_next/**`, `/favicon.ico`, etc. are allowed  
✅ **Reversible**: Simply set `PAUSE_SITE=false` to restore  
✅ **Owner bypass**: Secret token allows private access  
✅ **Cookie-based bypass**: Once bypassed, cookie persists for 30 days  

## Important Notes

- **Webhooks/Cron**: All `/api/**` routes continue working normally
- **No data loss**: This only affects page routing, not database or API functionality
- **SEO**: `/robots.txt` and `/sitemap.xml` are still accessible
- **Bypass cookie**: Set for 30 days, httpOnly, secure in production
- **307 redirect**: Temporary redirect preserves HTTP method (GET, POST, etc.)

## Troubleshooting

### Issue: Redirect loop
- **Solution**: Check that `/pause` is in the `allowedPaths` array (it is)

### Issue: API routes blocked
- **Solution**: Verify `/api` is in `allowedPaths` and middleware matcher allows it (it does)

### Issue: Bypass not working
- **Solution**: 
  1. Check `PAUSE_BYPASS_TOKEN` matches exactly (case-sensitive)
  2. Check cookie is set: DevTools → Application → Cookies
  3. Try clearing cookies and using query param again

### Issue: Pause page shows when PAUSE_SITE=false
- **Solution**: The pause page redirects to home if not paused, but check env var is actually `false` or unset

## Rollback Plan

If something goes wrong:

1. **Quick fix**: Set `PAUSE_SITE=false` in Vercel and redeploy
2. **Emergency**: You can also temporarily comment out the pause logic in `middleware.ts` and push
3. **Bypass**: Use your bypass token to access the site while fixing

---

**Implementation Date**: Today  
**Status**: ✅ Ready for production use

