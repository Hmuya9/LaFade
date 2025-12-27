# Mobile Safari Layout Fix - Root Cause & Solution

## Problem Summary

On iPhone Safari, after returning from booking/payment (Stripe redirect), the client dashboard UI becomes "weird": overlapping text/cards, shifted columns, layout breaks/compresses/overflows. Desktop looks fine.

## Root Causes Identified

### 1. **Flex/Grid Children Without `min-w-0` (Primary Issue)**
   - **File:** `web/src/app/account/page.tsx`
   - **Lines:** 862, 931
   - **Issue:** Flex children containing text didn't have `min-w-0`, causing them to overflow their containers on mobile Safari
   - **Impact:** Text would push beyond container boundaries, causing horizontal scroll and layout breaks

### 2. **Missing `width: 100%` on HTML/Body**
   - **File:** `web/src/app/globals.css`
   - **Line:** 5-10
   - **Issue:** Only had `overflow-x: hidden` but missing explicit `width: 100%`
   - **Impact:** iOS Safari can have viewport width calculation issues after redirects when URL bar changes

### 3. **Using `min-h-screen` Instead of `min-h-[100dvh]`**
   - **Files:** `web/src/app/layout.tsx` (line 35), `web/src/app/account/page.tsx` (line 790)
   - **Issue:** `100vh` on iOS Safari doesn't account for dynamic viewport height changes (URL bar show/hide)
   - **Impact:** Layout can shift/jump when URL bar appears/disappears, especially after redirects

### 4. **Grid Items Without `min-w-0`**
   - **File:** `web/src/app/account/page.tsx`
   - **Issue:** Grid items (col-span-8, col-span-4, col-span-12) didn't have `min-w-0` to prevent overflow
   - **Impact:** Grid items could overflow on mobile, causing horizontal scroll

### 5. **Missing `break-words` on Long Text**
   - **File:** `web/src/app/account/page.tsx`
   - **Lines:** 808, 867, 932, 933, 935
   - **Issue:** Long text (names, addresses, titles) could overflow without word breaking
   - **Impact:** Text would push beyond container boundaries

## Fixes Applied

### 1. Global CSS Updates (`web/src/app/globals.css`)
```diff
html, body {
+ width: 100%;
  height: 100%;
  overflow-x: hidden;
  margin: 0;
  padding: 0;
+ /* Prevent horizontal scroll on iOS Safari, especially after redirects */
+ position: relative;
}
```

### 2. Layout Height Fix (`web/src/app/layout.tsx`)
```diff
<body
- className={`${inter.variable} min-h-screen bg-zinc-50 text-zinc-900 antialiased`}
+ className={`${inter.variable} min-h-[100dvh] bg-zinc-50 text-zinc-900 antialiased`}
>
```

### 3. Account Page Main Container (`web/src/app/account/page.tsx`)
```diff
- <main className="min-h-screen" data-debug="account-v2">
+ <main className="min-h-[100dvh] w-full" data-debug="account-v2">
```

### 4. Grid Container Fix
```diff
- <div className="mx-auto max-w-6xl px-4 md:px-6 py-12 md:py-16 space-y-8">
-   <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
+ <div className="mx-auto max-w-6xl w-full px-4 md:px-6 py-12 md:py-16 space-y-8">
+   <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 min-w-0">
```

### 5. Flex Children with Text - Added `min-w-0` and `break-words`
```diff
- <div className="flex items-center gap-3 pr-20">
-   <CardTitle className="text-2xl font-semibold tracking-tight text-zinc-900">
+ <div className="flex items-center gap-3 pr-20">
+   <CardTitle className="text-2xl font-semibold tracking-tight text-zinc-900 min-w-0 break-words">
```

```diff
- <div className="border-l border-dashed border-zinc-200 pl-5 flex-1">
-   <h3 className="font-semibold text-lg text-zinc-900 leading-tight">
+ <div className="border-l border-dashed border-zinc-200 pl-5 flex-1 min-w-0">
+   <h3 className="font-semibold text-lg text-zinc-900 leading-tight break-words">
```

### 6. All Grid Items - Added `min-w-0`
- Added `min-w-0` to all `col-span-8`, `col-span-4`, and `col-span-12` sections
- Added `break-words` to headings and text that might overflow

## Files Changed

1. `web/src/app/globals.css` - Added `width: 100%` and `position: relative`
2. `web/src/app/layout.tsx` - Changed `min-h-screen` to `min-h-[100dvh]`
3. `web/src/app/account/page.tsx` - Multiple fixes:
   - Main container: `min-h-[100dvh] w-full`
   - Grid container: `w-full min-w-0`
   - All grid items: Added `min-w-0`
   - Flex children with text: Added `min-w-0 break-words`
   - Headings/text: Added `break-words` where needed

## Testing Checklist for iPhone Safari

### Before Testing
- [ ] Clear Safari cache and cookies
- [ ] Ensure you're on a real iPhone (not simulator, if possible)
- [ ] Test on iOS Safari (not Chrome on iOS)

### Test Scenarios

#### 1. Initial Load
- [ ] Open `/account` directly on iPhone Safari
- [ ] Verify no horizontal scroll
- [ ] Verify cards don't overlap
- [ ] Verify text doesn't overflow containers
- [ ] Scroll up/down - verify layout stays stable

#### 2. After Stripe Redirect (Primary Test)
- [ ] Complete a booking/payment flow
- [ ] Get redirected back to `/account?justBooked=1`
- [ ] **CRITICAL:** Verify layout doesn't break
- [ ] Verify no horizontal scroll appears
- [ ] Verify cards remain properly aligned
- [ ] Verify text wraps correctly
- [ ] Scroll up/down - verify URL bar show/hide doesn't break layout

#### 3. URL Bar Interaction
- [ ] Scroll to top (URL bar appears)
- [ ] Scroll down (URL bar hides)
- [ ] Verify layout doesn't jump/shift
- [ ] Verify no horizontal scroll appears

#### 4. Long Content
- [ ] Test with long barber names
- [ ] Test with long addresses
- [ ] Verify text wraps with `break-words`
- [ ] Verify no overflow

#### 5. Orientation Change
- [ ] Rotate to landscape
- [ ] Rotate back to portrait
- [ ] Verify layout adapts correctly
- [ ] Verify no horizontal scroll

### Expected Results
✅ No horizontal scroll at any point
✅ Cards remain properly aligned
✅ Text wraps correctly within containers
✅ Layout doesn't shift when URL bar appears/disappears
✅ No overlapping elements
✅ Grid columns stack correctly on mobile

## Technical Notes

### Why `min-w-0`?
- Flexbox and Grid items have a default `min-width: auto`, which prevents them from shrinking below their content size
- On mobile, this can cause overflow
- `min-w-0` allows items to shrink, enabling proper text wrapping

### Why `100dvh` instead of `100vh`?
- iOS Safari's URL bar changes the viewport height dynamically
- `100vh` uses the initial viewport height, which can be incorrect when URL bar is hidden
- `100dvh` (dynamic viewport height) accounts for the actual visible viewport

### Why `width: 100%` on html/body?
- Ensures containers never exceed viewport width
- Prevents horizontal scroll on iOS Safari, especially after redirects when viewport calculations can be inconsistent

## Prevention

For future components:
1. Always add `min-w-0` to flex/grid children that contain text
2. Use `min-h-[100dvh]` instead of `min-h-screen` for full-height layouts
3. Add `break-words` to headings and text that might be long
4. Ensure grid containers have `w-full min-w-0`
5. Test on real iPhone Safari after redirects

