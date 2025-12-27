# Mobile Safari Viewport Fix - Critical Bug Resolution

## Problem

After booking/payment redirect on iPhone Safari, layout collapses into thin columns; text becomes vertical. iOS Safari was rendering at ~980px "desktop" width, triggering Tailwind `md:` breakpoints, then scaling down.

## Root Cause

**Missing viewport meta tag** in Next.js App Router layout. Without explicit viewport metadata, iOS Safari defaults to ~980px desktop width, causing:
- `md:grid-cols-12` to activate on mobile (should be `grid-cols-1`)
- Layout to render as desktop, then scale down
- Thin vertical columns and vertical text

## Fix Applied

### File: `web/src/app/layout.tsx`

**Added viewport export:**
```typescript
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
```

This ensures Next.js outputs:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

## Verification

### ✅ No Conflicting Viewport Tags
- Checked for `_document.tsx` - None found
- Checked for `head.tsx` - None found
- No custom viewport meta tags found

### ✅ No Fixed Desktop Widths
- `max-w-6xl` is a max-width (not fixed), safe for mobile
- No `w-[980px]` or `min-w-[980px]` found
- All containers use responsive classes

### ✅ Tailwind Breakpoints Correct
- Grid uses `grid-cols-1 md:grid-cols-12` (mobile-first)
- All responsive utilities follow mobile-first pattern
- No desktop-only fixed widths

### ✅ Global CSS Safe
- `html, body { width: 100%; }` ensures no forced desktop width
- `overflow-x: hidden` prevents horizontal scroll

## Expected Behavior

### Before Fix
- iPhone Safari renders at ~980px width
- `md:` breakpoints activate (md = 768px+)
- Layout shows 12-column grid on mobile
- Text becomes vertical/compressed

### After Fix
- iPhone Safari renders at device width (e.g., 390px for iPhone 13)
- `md:` breakpoints do NOT activate on mobile
- Layout shows single-column (`grid-cols-1`)
- Text flows normally

## Testing Checklist

### iPhone Safari Tests

1. **Initial Load**
   - [ ] Open `/account` directly
   - [ ] Verify single-column layout (not 12 columns)
   - [ ] Verify text is horizontal (not vertical)
   - [ ] Check viewport width = device width (not ~980px)

2. **After Stripe Redirect** (CRITICAL)
   - [ ] Complete booking/payment flow
   - [ ] Get redirected to `/account?justBooked=1`
   - [ ] Verify layout remains single-column
   - [ ] Verify no thin vertical columns
   - [ ] Verify text remains horizontal

3. **Viewport Meta Tag**
   - [ ] Inspect page source
   - [ ] Verify `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` exists
   - [ ] Verify it's in `<head>` section

4. **Computed Width**
   - [ ] Use Safari Web Inspector
   - [ ] Check computed viewport width = device width (e.g., 390px)
   - [ ] Verify NOT ~980px

## Technical Details

### Next.js 14 App Router Viewport
- In App Router, viewport metadata is exported separately from `metadata`
- Must import `Viewport` type from `next`
- Next.js automatically generates the `<meta name="viewport">` tag

### Why `viewportFit: "cover"`
- Optional but recommended for iOS devices with notches
- Ensures content extends to edges on modern iPhones
- Safe to include, doesn't affect older devices

### Why This Wasn't Caught Earlier
- Desktop browsers don't need explicit viewport (defaults work)
- Android Chrome handles missing viewport better
- iOS Safari is strict about viewport meta tag
- Issue only manifests after redirects when Safari recalculates viewport

## Files Changed

1. `web/src/app/layout.tsx`
   - Added `Viewport` import
   - Added `viewport` export with proper configuration

## Related Fixes

This fix works in conjunction with previous mobile Safari fixes:
- `min-w-0` on flex/grid children
- `min-h-[100dvh]` instead of `min-h-screen`
- `width: 100%` on html/body
- `break-words` on long text

All fixes together ensure robust mobile Safari compatibility, especially after redirects.

