/**
 * LaFade Design System Style Tokens
 * 
 * Extracted from the "Gold Standard" /account page styling.
 * Provides consistent, reusable style tokens across the application.
 */

export const laf = {
  // Page wrapper - neutral grey background with antialiasing
  page: "min-h-screen bg-zinc-50 antialiased text-zinc-900",

  // Optional subtle texture - add to pages that use it (not required everywhere)
  texture:
    "relative before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.035)_1px,transparent_0)] before:bg-[length:18px_18px] before:opacity-60",

  // Container - centered max-width with padding
  container: "mx-auto max-w-5xl px-4 py-10",

  // Typography
  h1: "tracking-tight text-3xl sm:text-4xl font-semibold text-zinc-900",
  h2: "tracking-tight text-xl font-semibold text-zinc-900",
  sub: "text-zinc-600 text-sm leading-relaxed",

  // Card system - double border effect with subtle shadows
  card:
    "rounded-2xl bg-white/80 backdrop-blur border border-zinc-200 shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_24px_rgba(0,0,0,0.06)]",
  cardInner:
    "rounded-2xl border border-zinc-100",
  cardPad: "p-6",

  // Utility classes
  mono: "font-mono tabular-nums",
  divider: "border-t border-zinc-200/70",

  // Form elements
  input:
    "w-full rounded-xl bg-white border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/15 focus:border-zinc-900/30",
  button:
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition active:translate-y-[1px]",
  buttonGhost:
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium bg-white/70 border border-zinc-200 text-zinc-900 hover:bg-white transition",
};


