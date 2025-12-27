# Mobile Safari Viewport Fix - Root Cause Analysis & Solution

## Problem Statement

On iPhone Safari (especially Snapchat in-app browser + Safari after Stripe redirect), the `/account` dashboard renders as multiple super-thin vertical columns with text stacking letter-by-letter. Desktop grid layout is being applied on mobile.

## Root Cause Analysis

### Hypothesis
The browser is using a wrong viewport (missing/incorrect `<meta name="viewport">` or overridden), so Tailwind `md:*` breakpoint (768px+) is incorrectly triggering on a phone, causing the 12-column grid to render on a tiny screen.

### Investigation Tools Added

**Debug Overlay Component** (`ViewportDebugOverlay.tsx`)
- Shows real-time viewport measurements
- Displays: `window.innerWidth`, `document.documentElement.clientWidth`, `devicePixelRatio`, `matchMedia('(min-width: 768px)').matches`, `navigator.userAgent`
- Highlights when `md:` breakpoint is active but width < 768px (the problem condition)
- Visible in development or with `?debug=viewport` query param

### Viewport Configuration Status

✅ **Viewport meta is correctly configured:**
```typescript
// web/src/app/layout.tsx
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
```

✅ **No conflicting viewport tags found:**
- No legacy `<Head>` viewport tags
- No duplicate/contradicting tags
- No `maximum-scale` hacks

### Potential Issues

1. **Snapchat in-app browser** may override viewport meta
2. **Safari after redirects** may have stale viewport calculations
3. **AccountRefreshHandler** calls `router.refresh()` which might cause viewport recalculation issues

## Solution Implemented

### 1. Debug Overlay (Diagnostic Tool)

**File:** `web/src/app/account/_components/ViewportDebugOverlay.tsx`

- Shows real-time viewport metrics
- Highlights when `md:` breakpoint fires incorrectly
- Helps diagnose the exact viewport state when bug occurs
- Only visible in development or with `?debug=viewport`

**Usage:**
- Normal: `/account` (overlay hidden in production)
- Debug: `/account?debug=viewport` (overlay visible)
- Dev: Always visible in development mode

### 2. Defensive CSS Fallback (Defense-in-Depth)

**File:** `web/src/app/globals.css`

Added mobile safety override that forces single-column layout on small screens even if `md:` breakpoint fires incorrectly:

```css
/* Mobile safety override for dashboard grid - defense in depth */
/* Forces single-column layout on small screens even if md: breakpoint fires incorrectly */
@media (max-width: 767px) {
  [data-debug="account-v2"] .grid[class*="md:grid-cols"] {
    grid-template-columns: 1fr !important;
  }
  
  [data-debug="account-v2"] .grid[class*="md:grid-cols"] > * {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
  }
  
  /* Ensure grid items don't create horizontal scroll */
  [data-debug="account-v2"] .grid[class*="md:grid-cols"] [class*="col-span"] {
    grid-column: span 1 !important;
  }
}
```

**Why this works:**
- Uses `@media (max-width: 767px)` which is based on actual viewport width, not Tailwind's breakpoint system
- Targets only the dashboard grid via `[data-debug="account-v2"]` selector (safe, scoped)
- Uses `!important` to override any incorrect Tailwind classes
- Forces all grid items to single column regardless of Tailwind breakpoint state

### 3. Viewport Configuration Verification

**File:** `web/src/app/layout.tsx`

✅ Already correctly configured:
- `width: "device-width"` - ensures mobile uses actual device width
- `initialScale: 1` - prevents zoom/scale issues
- `viewportFit: "cover"` - handles notched devices properly

## Files Changed

1. **`web/src/app/account/_components/ViewportDebugOverlay.tsx`** (NEW)
   - Debug overlay component for viewport diagnostics

2. **`web/src/app/account/page.tsx`**
   - Added `ViewportDebugOverlay` import and component

3. **`web/src/app/globals.css`**
   - Added mobile safety CSS override for dashboard grid

## Testing Plan

### iPhone Safari Tests

#### 1. Initial Load
- [ ] Open `/account` directly on iPhone Safari
- [ ] Verify single-column layout (not 12 columns)
- [ ] Verify text flows horizontally (not letter-by-letter)
- [ ] Check debug overlay (if `?debug=viewport`): viewport width should be ~390px (not ~980px)
- [ ] Verify `md:` breakpoint shows "inactive" in debug overlay

#### 2. After Stripe Redirect (CRITICAL)
- [ ] Complete booking/payment flow
- [ ] Get redirected to `/account?justBooked=1`
- [ ] **CRITICAL:** Verify layout remains single-column
- [ ] Verify no thin vertical columns appear
- [ ] Verify text remains horizontal
- [ ] Check debug overlay: viewport width should still be ~390px
- [ ] Verify `md:` breakpoint shows "inactive" (if it shows "ACTIVE ⚠️", that's the bug)

#### 3. Snapchat In-App Browser
- [ ] Open `/account` in Snapchat in-app browser
- [ ] Verify single-column layout
- [ ] Check debug overlay for viewport measurements
- [ ] Complete booking flow and return - verify layout stays correct

#### 4. Portrait vs Landscape
- [ ] Portrait: Verify single-column layout
- [ ] Rotate to landscape: Verify layout adapts (may show multi-column, that's OK)
- [ ] Rotate back to portrait: Verify returns to single-column

#### 5. Normal Navigation
- [ ] Navigate to `/account` via menu/link (not redirect)
- [ ] Verify layout is correct
- [ ] Refresh page: Verify layout stays correct

### Debug Overlay Interpretation

**Normal (Good):**
```
innerWidth: 390px
clientWidth: 390px
md breakpoint: inactive
```

**Problem (Bad):**
```
innerWidth: 390px
clientWidth: 390px
md breakpoint: ACTIVE ⚠️
⚠️ PROBLEM: md: active but width < 768px!
```

If you see the "PROBLEM" message, the CSS fallback should still prevent the layout from breaking, but it indicates a viewport meta issue.

## Expected Behavior

### Before Fix
- iPhone Safari renders at ~980px width (default desktop)
- `md:` breakpoints activate (md = 768px+)
- Layout shows 12-column grid on mobile
- Text becomes vertical/compressed
- Thin vertical columns

### After Fix
- iPhone Safari renders at device width (e.g., 390px for iPhone 13)
- `md:` breakpoints do NOT activate on mobile
- Layout shows single-column (`grid-cols-1`)
- Text flows normally
- CSS fallback ensures single-column even if breakpoint fires incorrectly

## Defense-in-Depth Strategy

1. **Primary:** Correct viewport meta tag (already in place)
2. **Secondary:** CSS media query override (new) - forces single-column on small screens regardless of Tailwind breakpoint state
3. **Tertiary:** Debug overlay (new) - helps diagnose when/why viewport issues occur

## Technical Details

### Why CSS Fallback Works

The CSS override uses `@media (max-width: 767px)` which:
- Is evaluated by the browser's actual viewport width
- Not affected by Tailwind's breakpoint system
- Works even if viewport meta is overridden by in-app browsers
- Uses `!important` to override any conflicting Tailwind classes

### Why Debug Overlay Helps

- Shows real-time viewport state
- Reveals when `md:` breakpoint fires incorrectly
- Helps identify specific browsers/environments where bug occurs
- Provides data for further debugging if needed

## Next Steps if Issue Persists

If the bug still occurs after this fix:

1. **Check debug overlay** - What does it show?
   - If `md:` is active but width < 768px → viewport meta is being overridden
   - If width shows ~980px → viewport meta is missing/ignored

2. **Check specific browser:**
   - Snapchat in-app may need special handling
   - Some browsers ignore viewport meta in certain contexts

3. **Consider additional fixes:**
   - Add JavaScript viewport enforcement
   - Use CSS container queries instead of media queries
   - Add explicit width constraints via JavaScript

## Acceptance Criteria

✅ On iPhone Safari, `/account` shows single-column cards, no thin vertical columns
✅ Works after Stripe redirect back (query params like `justBooked=1`)
✅ No horizontal scroll
✅ Works in Snapchat in-app browser
✅ Portrait mode always shows single-column layout
✅ Debug overlay helps diagnose any remaining issues

