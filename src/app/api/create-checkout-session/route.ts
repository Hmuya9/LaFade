/**
 * /api/create-checkout-session
 * 
 * Handles three types of Stripe Checkout Session creation:
 * 
 * 1. DISCOUNT_SECOND ($10 second-cut promo):
 *    - Request body: { appointmentData: { kind: "DISCOUNT_SECOND", customerName, customerEmail, selectedDate, selectedTime, selectedBarber, ... } }
 *    - Creates one-time payment session (mode: "payment") for 1000 cents
 *    - Sets metadata.kind = "DISCOUNT_SECOND"
 *    - Does NOT require plan field (plan is optional for DISCOUNT_SECOND)
 * 
 * 2. Normal one-off bookings (standard/deluxe appointments):
 *    - Request body: { appointmentData: { plan: "standard" | "deluxe", customerName, customerEmail, selectedDate, selectedTime, selectedBarber, ... } }
 *    - Creates one-time payment session (mode: "payment")
 *    - Uses PRICING.standardCut or PRICING.deluxeCut
 *    - Sets metadata.plan and other appointment fields
 * 
 * 3. Subscription from /plans (Standard/Deluxe memberships):
 *    - Request body: { planId: "<plan_id_from_db>" }
 *    - Creates subscription session (mode: "subscription")
 *    - Resolves the plan from the database by id and uses plan.stripePriceId
 *    - Does NOT include appointmentData
 */

import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createErrorResponse } from "@/lib/error"
import { rateLimit, getClientIP } from "@/lib/rate-limit"
import { PRICING, getPricingByPlanId } from "@/lib/pricing"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const rateLimitResult = rateLimit(`checkout:${clientIP}`, 5, 60 * 1000) // 5 requests per minute
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { 
        status: 429,
        headers: {
          "Retry-After": Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString()
        }
      }
    )
  }

  // Check if Stripe is properly configured
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 501 }
    )
  }

  try {
    const body = await request.json();
    const { 
      planId,
      appointmentData 
    } = body;

    // Log incoming request for debugging
    if (process.env.NODE_ENV === "development") {
      console.log("[create-checkout-session] Incoming request:", {
        hasPriceId: !!priceId,
        hasAppointmentData: !!appointmentData,
        appointmentKind: appointmentData?.kind,
        appointmentPlan: appointmentData?.plan,
      });
    }

    // Branch 1: Subscription from /plans (has planId, no appointmentData)
    if (planId && !appointmentData) {
      // Get current user session to include userId in metadata (optional but helpful)
      const session = await auth();
      const user = session?.user?.email
        ? await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
          })
        : null;

      // Safety guard: Check if user already has an active subscription
      if (user) {
        const activeSubscription = await prisma.subscription.findFirst({
          where: {
            userId: user.id,
            status: { in: ["ACTIVE", "TRIAL"] },
          },
        });

        if (activeSubscription) {
          console.log("[create-checkout-session][SUBSCRIPTION] User already has active membership", {
            userId: user.id,
            subscriptionId: activeSubscription.id,
            status: activeSubscription.status,
          });
          return NextResponse.json(
            {
              error: "You already have an active membership. Please book through the booking page to use your included cuts.",
              code: "ALREADY_MEMBER",
            },
            { status: 400 }
          );
        }
      }

      return await handleSubscriptionCheckout(planId, user?.id);
    }

    // Branch 2: Appointment booking (has appointmentData, may or may not have priceId)
    if (appointmentData) {
      return await handleAppointmentCheckout(appointmentData);
    }

    // Neither branch matched - invalid request
    return NextResponse.json(
      { error: "Either planId (for subscriptions) or appointmentData (for bookings) is required" },
      { status: 400 }
    );
  } catch (error) {
    return createErrorResponse(error)
  }
}

/**
 * Handle subscription checkout from /plans page.
 * Resolves the plan from the database by its primary key (planId)
 * and uses plan.stripePriceId for the Stripe price.
 */
async function handleSubscriptionCheckout(planId: string, userId?: string) {
  // DEBUG: log which key & account this server is actually using
  const rawKey = process.env.STRIPE_SECRET_KEY || "";
  console.log("[stripe-debug] key prefix/suffix", {
    prefix: rawKey.slice(0, 12),
    suffix: rawKey.slice(-6),
  });

  try {
    const account = await stripe.accounts.retrieve();
    console.log("[stripe-debug] account", {
      id: account.id,
      email: (account as any).email,
      business_profile: account.business_profile?.name,
    });
  } catch (err) {
    console.error("[stripe-debug] failed to retrieve account", err);
  }

  console.log("[create-checkout-session][SUBSCRIPTION][START] Incoming request", {
    planId,
    userId,
    mode: "subscription",
  });

  if (!planId || typeof planId !== "string" || planId.trim() === "") {
    console.error(
      "[create-checkout-session][SUBSCRIPTION] Missing or invalid planId for subscription:",
      planId
    );
    return NextResponse.json(
      {
        error: "Subscription plan is not specified.",
        code: "MISSING_PLAN_ID",
      },
      { status: 400 }
    );
  }

  // Verify Stripe is configured
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "sk_test_placeholder") {
    console.error("[create-checkout-session][SUBSCRIPTION] Stripe secret key not configured");
    return NextResponse.json(
      {
        error: "Payment processing is not configured. Please contact support.",
        code: "STRIPE_NOT_CONFIGURED",
      },
      { status: 500 }
    );
  }

  try {
    // Lookup the plan by its primary key
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { id: true, name: true, stripePriceId: true, priceMonthly: true },
    });

    if (!plan) {
      console.error("[create-checkout-session][SUBSCRIPTION][ERROR] Plan not found for planId", {
        requestedPlanId: planId,
      });
      return NextResponse.json(
        {
          error: "Subscription plan not found. Please try a different plan or contact support.",
          code: "PLAN_NOT_FOUND",
        },
        { status: 400 }
      );
    }

    if (!plan.stripePriceId || plan.stripePriceId.trim() === "") {
      console.error("[create-checkout-session][SUBSCRIPTION][ERROR] Plan is missing stripePriceId", {
        planId: plan.id,
        planName: plan.name,
      });
      return NextResponse.json(
        {
          error: "Stripe price ID is not configured for this subscription plan",
          code: "MISSING_SUB_PRICE",
        },
        { status: 400 }
      );
    }

    console.log("[create-checkout-session][SUBSCRIPTION][SUCCESS] Plan found", {
      planId: plan.id,
      planName: plan.name,
      stripePriceId: plan.stripePriceId,
      priceMonthly: plan.priceMonthly,
    });

    // 🔑 IMPORTANT: pass plan + user metadata so webhook/sync can resolve it
    const metadata: Record<string, string> = {
      source: "plans_page",
    };

    if (userId) {
      metadata.userId = userId;
    }

    if (plan.id) {
      metadata.planId = plan.id;
    }

    if (plan.name) {
      metadata.planName = plan.name;
    }

    console.log("[create-checkout-session][SUBSCRIPTION] Creating session with metadata", {
      planId: plan.id,
      userId,
      planName: plan.name,
      metadata,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/account?session_id={CHECKOUT_SESSION_ID}`,
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== "sk_test_placeholder",
      stripeKeyMode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live") ? "sk_live" : process.env.STRIPE_SECRET_KEY?.startsWith("sk_test") ? "sk_test" : "unknown",
      stripeKeyPrefix: process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.slice(0, 7) : "missing",
    });

    // Validate NEXT_PUBLIC_APP_URL is set
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      console.error("[create-checkout-session][SUBSCRIPTION] NEXT_PUBLIC_APP_URL not configured");
      return NextResponse.json(
        {
          error: "Application URL is not configured. Please contact support.",
          code: "CONFIG_ERROR",
        },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/account?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/plans?canceled=true`,
      allow_promotion_codes: true,
      metadata,
    });

    console.log("[create-checkout-session][SUBSCRIPTION] Subscription session created:", {
      sessionId: session.id,
      url: session.url ? "present" : "missing",
    });

    return NextResponse.json({ url: session.url });
  } catch (stripeError: any) {
    console.error("[create-checkout-session][SUBSCRIPTION] Stripe subscription error:", {
      message: stripeError?.message,
      type: stripeError?.type,
      code: stripeError?.code,
      planId,
      userId,
      raw: process.env.NODE_ENV === "development" ? stripeError : undefined,
      stack: process.env.NODE_ENV === "development" ? stripeError?.stack : undefined,
    });
    
    // Provide more specific error messages based on Stripe error type
    let userMessage = "Failed to create subscription checkout";
    if (stripeError.code === "resource_missing") {
      userMessage = "The selected plan is not available. Please try a different plan or contact support.";
    } else if (stripeError.code === "invalid_request_error") {
      userMessage = "Invalid checkout request. Please refresh the page and try again.";
    } else if (stripeError.type === "StripeAuthenticationError") {
      userMessage = "Payment processing is temporarily unavailable. Please contact support.";
    } else if (stripeError.message) {
      // Include Stripe error message in development for debugging
      userMessage = process.env.NODE_ENV === "development" 
        ? `Failed to create subscription checkout: ${stripeError.message}`
        : "Failed to create subscription checkout. Please try again or contact support.";
    }
    
    return NextResponse.json(
      { 
        error: userMessage,
        stripe_error: stripeError.message || "Unknown Stripe error",
        stripe_code: stripeError.code,
        code: "STRIPE_ERROR",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle appointment booking checkout (one-time payments)
 * Supports: DISCOUNT_SECOND, normal standard/deluxe bookings, free trials
 */
async function handleAppointmentCheckout(appointmentData: any) {
  const { customerName, customerEmail, selectedDate, selectedTime, selectedBarber, plan, kind, bookingStateType } = appointmentData;
  
  if (process.env.NODE_ENV !== "production") {
    console.log("[V1 CHECK]", { bookingStateType, plan, kind });
  }
  
  // Log incoming request for DISCOUNT_SECOND debugging
  if (kind === "DISCOUNT_SECOND" || process.env.NODE_ENV === "development") {
    console.log("[create-checkout-session] Appointment data:", {
      kind,
      plan,
      customerEmail,
      selectedDate,
      selectedTime,
      selectedBarber,
    });
  }
  
  // Safety check: Prevent payment mode with recurring prices or if user has active membership
  // This prevents the "payment mode + recurring price" Stripe error
  if (customerEmail && !kind) {
    // Check if user has active membership
    const user = await prisma.user.findUnique({
      where: { email: customerEmail },
      include: {
        subscriptions: {
          where: {
            status: { in: ["TRIAL", "ACTIVE"] },
          },
        },
      },
    });

    if (user && user.subscriptions.length > 0) {
      return NextResponse.json(
        { 
          error: "You already have an active membership. Please book through the booking page to use your included cuts.",
          code: "ACTIVE_MEMBERSHIP",
        },
        { status: 400 }
      );
    }

    // Check if the plan's price ID is a recurring price (subscription price)
    if (plan && (plan === "standard" || plan === "deluxe")) {
      const pricing = getPricingByPlanId(plan as "standard" | "deluxe");
      if (pricing.stripePriceId) {
        try {
          const price = await stripe.prices.retrieve(pricing.stripePriceId);
          if (price.recurring) {
            return NextResponse.json(
              { 
                error: "This plan requires a subscription. Please subscribe on the Plans page first.",
                code: "RECURRING_PRICE",
              },
              { status: 400 }
            );
          }
        } catch (stripeError) {
          // If we can't retrieve the price, log but continue (might be a test price)
          console.warn("[create-checkout-session] Could not verify price type:", stripeError);
        }
      }
    }
  }
  
  // Validate required fields (plan is optional for DISCOUNT_SECOND)
  const missing = [];
  if (!customerName) missing.push("customerName");
  if (!customerEmail) missing.push("customerEmail");
  if (!selectedDate) missing.push("selectedDate");
  if (!selectedTime) missing.push("selectedTime");
  if (!selectedBarber) missing.push("selectedBarber");
  
  // Plan is only required for non-DISCOUNT_SECOND bookings
  if (!kind || kind !== "DISCOUNT_SECOND") {
    if (!plan) missing.push("plan");
  }
  
  if (missing.length > 0) {
    console.error("[create-checkout-session] Missing required fields:", missing);
    return NextResponse.json(
      { error: `Missing required appointment data: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  // V1 ENFORCEMENT: Block one-off Standard/Deluxe payments (must be subscription).
  // CRITICAL: Must check bookingStateType === "ONE_OFF" to avoid blocking MEMBERSHIP_INCLUDED bookings.
  if (
    bookingStateType === "ONE_OFF" &&
    (plan === "standard" || plan === "deluxe") &&
    kind !== "DISCOUNT_SECOND"
  ) {
    return NextResponse.json(
      {
        error: "Standard and Deluxe cuts require a subscription. Please subscribe on the Plans page first.",
        code: "SUBSCRIPTION_REQUIRED",
      },
      { status: 400 }
    );
  }

  // Special handling for $10 second-cut promo (DISCOUNT_SECOND)
  if (kind === "DISCOUNT_SECOND") {
    // Explicit logging: incoming body
    console.log("[create-checkout-session][DISCOUNT_SECOND] Incoming request body:", {
      kind,
      plan,
      customerEmail,
      selectedDate,
      selectedTime,
      selectedBarber,
      customerName,
    });

    const pricing = PRICING.secondCut10;
    const secondPriceId = pricing.stripePriceId;

    // Explicit logging: PRICING.secondCut10 and priceId
    console.log("[create-checkout-session][DISCOUNT_SECOND] PRICING.secondCut10:", pricing);
    console.log("[create-checkout-session][DISCOUNT_SECOND] secondPriceId from PRICING:", secondPriceId);
    console.log("[create-checkout-session][DISCOUNT_SECOND] env var NEXT_PUBLIC_STRIPE_PRICE_SECOND_CUT:", process.env.NEXT_PUBLIC_STRIPE_PRICE_SECOND_CUT);

    // For DISCOUNT_SECOND, we use price_data (one-time payment) instead of a recurring price ID
    // This ensures mode: "payment" works correctly (recurring prices require mode: "subscription")
    const lineItems = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: pricing.label,
            description: selectedDate && selectedTime 
              ? `Second-cut promo appointment on ${selectedDate} at ${selectedTime}`
              : `${pricing.label} appointment`,
          },
          unit_amount: pricing.cents, // 1000 cents = $10.00
        },
        quantity: 1,
      },
    ];

    // Log pricing details right before Stripe call
    console.log("[create-checkout-session][DISCOUNT_SECOND] Creating Stripe session with:", {
      mode: "payment",
      lineItemsCount: lineItems.length,
      usingPriceData: true, // Using price_data instead of price ID
      amount: pricing.cents,
      secondPriceId: secondPriceId || "null (using price_data instead)",
    });
    console.log("[create-checkout-session][DISCOUNT_SECOND] pricing:", pricing);
    console.log("[create-checkout-session][DISCOUNT_SECOND] Using price_data for one-time $10 payment (not recurring price ID)");

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: lineItems,
        customer_email: customerEmail,
        metadata: {
          customerName,
          customerEmail,
          selectedDate,
          selectedTime,
          selectedBarber,
          // Include plan for webhook compatibility (webhook validation requires it)
          plan: plan || "standard", // Use provided plan or default to "standard"
          kind: "DISCOUNT_SECOND",
        },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/account?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/booking?canceled=true`,
      });

      console.log("[create-checkout-session][DISCOUNT_SECOND] Stripe session created:", {
        sessionId: session.id,
        url: session.url ? "present" : "missing",
      });

      return NextResponse.json({ url: session.url });
    } catch (stripeError: any) {
      // Explicit logging: full Stripe error details
      console.error("[create-checkout-session][DISCOUNT_SECOND] Stripe error occurred:", {
        type: stripeError.type,
        code: stripeError.code,
        message: stripeError.message,
        pricing: { label: pricing.label, cents: pricing.cents },
        secondPriceId,
        stack: process.env.NODE_ENV === "development" ? stripeError.stack : undefined,
      });

      return NextResponse.json(
        {
          error: "Failed to create second-cut payment",
          stripe_error: stripeError.message ?? "Unknown Stripe error",
          stripe_code: stripeError.code,
        },
        { status: 500 }
      );
    }
  }

  // Determine pricing for normal bookings (standard/deluxe/trial)
  // For normal bookings, plan is required
  if (!plan) {
    return NextResponse.json(
      { error: "Plan is required for non-promo bookings" },
      { status: 400 }
    );
  }

  const pricing = getPricingByPlanId(plan as "trial" | "standard" | "deluxe");

  // For free trials, redirect to success page without payment
  if (pricing.cents === 0) {
    return NextResponse.json({ 
      url: `${process.env.NEXT_PUBLIC_APP_URL}/booking?success=true&plan=trial&barber=${selectedBarber}&date=${selectedDate}&time=${selectedTime}&email=${customerEmail}` 
    });
  }

  // Use Stripe price ID if available, otherwise create price_data on the fly
  const lineItems = pricing.stripePriceId
    ? [{ price: pricing.stripePriceId, quantity: 1 }]
    : [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${pricing.label}${selectedBarber ? ` with ${selectedBarber}` : ""}`,
              description: selectedDate && selectedTime 
                ? `Appointment on ${selectedDate} at ${selectedTime}`
                : `${pricing.label} appointment`,
            },
            unit_amount: pricing.cents,
          },
          quantity: 1,
        },
      ];

  if (kind === "DISCOUNT_SECOND" || process.env.NODE_ENV === "development") {
    console.log("[create-checkout-session] Creating Stripe session with:", {
      mode: "payment",
      lineItemsCount: lineItems.length,
      usingStripePriceId: !!pricing.stripePriceId,
      amount: pricing.cents,
      kind: kind || "none",
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      customer_email: customerEmail,
      metadata: {
        customerName,
        customerEmail,
        selectedDate,
        selectedTime,
        selectedBarber,
        ...(plan ? { plan } : {}),
        ...(kind ? { kind } : {}),
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/account?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/booking?canceled=true`,
    });

    if (kind === "DISCOUNT_SECOND" || process.env.NODE_ENV === "development") {
      console.log("[create-checkout-session] Stripe session created:", {
        sessionId: session.id,
        url: session.url ? "present" : "missing",
        kind: kind || "none",
      });
    }

    return NextResponse.json({ url: session.url });
  } catch (stripeError: any) {
    console.error("[create-checkout-session] Stripe error for appointment:", {
      message: stripeError.message,
      type: stripeError.type,
      code: stripeError.code,
      kind: kind || "none",
      pricing: { label: pricing.label, cents: pricing.cents },
      stack: process.env.NODE_ENV === "development" ? stripeError.stack : undefined,
    });
    
    // Return a more specific error for Stripe failures
    return NextResponse.json(
      { 
        error: "Failed to create payment session",
        stripe_error: stripeError.message || "Unknown Stripe error",
        stripe_code: stripeError.code,
        devError: process.env.NODE_ENV === "development" ? stripeError.message : undefined,
      },
      { status: 500 }
    );
  }
}

