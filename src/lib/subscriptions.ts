import { stripe } from "@/lib/stripe";
import { prisma, withPrismaRetry } from "@/lib/db";
import { credit } from "@/lib/points";
import type Stripe from "stripe";
import type { Subscription as DbSubscription } from "@prisma/client";

/**
 * Type guard to ensure we have a Stripe.Subscription object
 * (not a string ID or Prisma Subscription type)
 */
function isStripeSubscription(
  sub: string | Stripe.Subscription | null
): sub is Stripe.Subscription {
  return sub !== null && typeof sub === "object" && "current_period_end" in sub;
}

/**
 * Syncs a subscription from a Stripe Checkout Session to the database.
 * This is called when the user is redirected back to /account?session_id=...
 * after completing a subscription checkout.
 * 
 * This provides a reliable fallback when webhooks are not configured or fail.
 * 
 * @param params.sessionId - The Stripe Checkout Session ID (from query param)
 * @param params.currentUserId - The authenticated user's ID (from session)
 */
export async function syncSubscriptionFromCheckoutSession(params: {
  sessionId: string;
  currentUserId: string;
}): Promise<void> {
  const { sessionId, currentUserId } = params;

  console.log("[subscription-sync] start", {
    sessionId,
    userId: currentUserId,
  });

  try {
    // Retrieve the checkout session with expanded subscription and customer
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    // DEBUG: Log Stripe session summary
    const subscriptionId = typeof session.subscription === "string" 
      ? session.subscription 
      : session.subscription?.id;
    console.log("[subscription-sync] stripe session summary =", {
      id: session.id,
      mode: session.mode,
      status: session.status,
      customer_email: session.customer_email,
      metadata: session.metadata ?? {},
      subscriptionId,
      hasSubscription: !!session.subscription,
    });

    // Guard: Only process subscription checkouts
    if (session.mode !== "subscription") {
      console.log("[subscription-sync] Not a subscription checkout, skipping", {
        sessionId,
        mode: session.mode,
      });
      return;
    }

    // Guard: Only process completed sessions
    if (session.status !== "complete") {
      console.log("[subscription-sync] Session not complete, skipping", {
        sessionId,
        status: session.status,
      });
      return;
    }

    // Get the Stripe subscription object
    // When expanded, session.subscription is string | Stripe.Subscription | null
    const subscriptionRaw = session.subscription;
    if (!subscriptionRaw || typeof subscriptionRaw === "string") {
      console.error("[subscription-sync] No subscription found in session", {
        sessionId,
        subscription: session.subscription,
      });
      return;
    }
    // Use type guard to ensure TypeScript recognizes this as Stripe.Subscription
    // This avoids collision with Prisma Subscription type
    if (!isStripeSubscription(subscriptionRaw)) {
      console.error("[subscription-sync] Invalid subscription object", {
        sessionId,
        subscription: subscriptionRaw,
      });
      return;
    }
    const stripeSub = subscriptionRaw; // TypeScript now knows this is Stripe.Subscription

    // ---------- PLAN RESOLUTION ----------
    // Determine the Plan: prefer metadata.planId, fall back to priceId lookup
    const metadata = session.metadata ?? {};
    console.log("[subscription-sync] metadata", metadata);

    let plan: { id: string; name: string; stripePriceId: string } | null = null;
    let planId: string | null = null;

    // 1) Prefer metadata.planId (this is what we just fixed in create-checkout-session)
    if (metadata.planId) {
      console.log("[subscription-sync] Resolving plan from metadata.planId", {
        sessionId,
        metaPlanId: metadata.planId,
      });
      plan = await withPrismaRetry(
        () =>
          prisma.plan.findUnique({
            where: { id: metadata.planId! },
          }),
        "subscription-sync-plan-metadata"
      );

      if (plan) {
        planId = plan.id;
        console.log("[subscription-sync] plan resolved via metadata", {
          planId,
          planName: plan.name,
        });
      }
    }

    // 2) Fallback: resolve by Stripe price on subscription
    if (!plan) {
      const items = stripeSub.items;
      const priceId = items?.data?.[0]?.price?.id ?? null;

      if (!priceId) {
        console.error("[subscription-sync] No price ID found in subscription", {
          sessionId,
          items: items?.data,
        });
        return;
      }

      console.log("[subscription-sync] Resolving plan from priceId (fallback)", {
        sessionId,
        priceId,
      });
      plan = await withPrismaRetry(
        () =>
          prisma.plan.findUnique({
            where: { stripePriceId: priceId },
          }),
        "subscription-sync-plan-priceid"
      );

      if (plan) {
        planId = plan.id;
        console.log("[subscription-sync] plan resolved via priceId", {
          planId,
          planName: plan.name,
          priceId,
        });
      }
    }

    if (!plan || !planId) {
      const items = stripeSub.items;
      console.error("[subscription-sync] could not resolve plan", {
        sessionId,
        metadata,
        priceId: items?.data?.[0]?.price?.id,
      });
      return;
    }

    console.log("[subscription-sync] plan resolved =", {
      planId: plan.id,
      planName: plan.name,
      stripePriceId: plan.stripePriceId,
    });

    // ---------- USER RESOLUTION ----------
    // Prefer metadata.userId but fall back to currentUserId
    const metaUserId = metadata.userId;
    const userId = metaUserId || currentUserId;
    console.log("[subscription-sync] using userId", { userId, fromMetadata: !!metaUserId, fromSession: !metaUserId });

    // Verify the user exists
    const user = await withPrismaRetry(
      () =>
        prisma.user.findUnique({
          where: { id: userId },
        }),
      "subscription-sync-user-lookup"
    );

    if (!user) {
      console.error("[subscription-sync] User not found", {
        sessionId,
        userId,
      });
      return;
    }

    // Compute subscription fields
    // Ensure TypeScript recognizes this as Stripe.Subscription by accessing Stripe-specific properties
    const stripeSubId: string = stripeSub.id;
    const stripeStatus = stripeSub.status;
    const status =
      stripeStatus === "active"
        ? "ACTIVE"
        : stripeStatus === "trialing"
        ? "TRIAL"
        : "ACTIVE"; // Default to ACTIVE for other statuses
    const startDate = new Date(stripeSub.created * 1000);
    // Access current_period_end from Stripe subscription
    // We've proven this is a Stripe subscription via type guard and runtime checks
    const currentPeriodEnd = (stripeSub as any).current_period_end;
    if (typeof currentPeriodEnd !== "number") {
      console.error("[subscription-sync] current_period_end is missing or invalid", {
        sessionId,
        stripeSubId: stripeSub.id,
      });
      return;
    }
    const renewsAt = new Date((stripeSub as any).current_period_end * 1000);

    // DEBUG: Log upsert data before attempting
    console.log("[subscription-sync] upsert data =", {
      stripeSubId,
      status,
      startDate: startDate.toISOString(),
      renewsAt: renewsAt.toISOString(),
      userId,
      planId: plan.id,
    });

    // Upsert subscription: check if it already exists
    const existingSubscription = await withPrismaRetry(
      () =>
        prisma.subscription.findUnique({
          where: { stripeSubId },
        }),
      "subscription-sync-findUnique"
    );

    const isNewSubscription = !existingSubscription;

    if (existingSubscription) {
      // Update existing subscription
      console.log("[subscription-sync] Updating existing subscription", {
        sessionId,
        subscriptionId: existingSubscription.id,
        stripeSubId,
      });

      const updatedSubscription = await withPrismaRetry(
        () =>
          prisma.subscription.update({
            where: { id: existingSubscription.id },
            data: {
              status,
              planId,
              userId,
              renewsAt,
            },
          }),
        "subscription-sync-update"
      );

      console.log("[subscription-sync] updated subscription =", JSON.stringify({
        id: updatedSubscription.id,
        userId: updatedSubscription.userId,
        planId: updatedSubscription.planId,
        stripeSubId: updatedSubscription.stripeSubId,
        status: updatedSubscription.status,
        startDate: updatedSubscription.startDate?.toISOString(),
        renewsAt: updatedSubscription.renewsAt?.toISOString(),
      }, null, 2));
    } else {
      // Create new subscription
      console.log("[subscription-sync] Creating new subscription", {
        sessionId,
        userId,
        planId,
        stripeSubId,
        status,
      });

      const subscription = await withPrismaRetry(
        () =>
          prisma.subscription.create({
            data: {
              userId,
              planId,
              stripeSubId,
              status,
              startDate,
              renewsAt,
            },
          }),
        "subscription-sync-create"
      );

      console.log("[subscription-sync] created subscription =", JSON.stringify({
        id: subscription.id,
        userId: subscription.userId,
        planId: subscription.planId,
        stripeSubId: subscription.stripeSubId,
        status: subscription.status,
        startDate: subscription.startDate?.toISOString(),
        renewsAt: subscription.renewsAt?.toISOString(),
      }, null, 2));

      // Award points only for new subscriptions (idempotency check)
      const existingCredit = await withPrismaRetry(
        () =>
          prisma.pointsLedger.findFirst({
            where: {
              userId,
              reason: "SUBSCRIBE_INIT",
              refType: "SUBSCRIPTION",
              refId: stripeSubId,
            },
          }),
        "subscription-sync-points-check"
      );

      if (!existingCredit) {
        await credit(userId, 10, "SUBSCRIBE_INIT", "SUBSCRIPTION", stripeSubId);
        console.log("[subscription-sync] Points credited", {
          sessionId,
          userId,
          pointsCredited: 10,
          stripeSubId,
        });
      } else {
        console.log("[subscription-sync] Points already credited, skipping", {
          sessionId,
          userId,
          existingCreditId: existingCredit.id,
        });
      }
    }

    // Final verification - query the subscription we just created/updated
    const verifySub = await withPrismaRetry(
      () =>
        prisma.subscription.findUnique({
          where: { stripeSubId },
          include: { plan: { select: { name: true } } },
        }),
      "subscription-sync-verification"
    );

    if (!verifySub) {
      console.error("[subscription-sync][CRITICAL] Subscription was not found after create/update!", {
        sessionId,
        stripeSubId,
        userId,
      });
    } else {
      console.log("[subscription-sync] VERIFICATION SUCCESS", {
        subscriptionId: verifySub.id,
        userId: verifySub.userId,
        planId: verifySub.planId,
        planName: verifySub.plan?.name,
        status: verifySub.status,
        stripeSubId: verifySub.stripeSubId,
      });
    }
  } catch (error) {
    console.error("[subscription-sync][ERROR]", {
      sessionId,
      userId: currentUserId,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    // Don't throw - we want the page to render even if sync fails
    // The webhook will eventually catch up
  }
}

/**
 * TODO: DEV ONLY. Once real Stripe sync is confirmed working, remove this helper
 * and rely solely on webhooks + syncSubscriptionFromCheckoutSession.
 * 
 * Dev-only helper that bypasses Stripe and directly creates a Subscription row.
 * This is used to prove that the funnel + booking logic works correctly once
 * a Subscription exists in the database.
 */
export async function devGrantMembershipForSession(params: {
  sessionId: string;
  userId: string;
}): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    console.log("[dev-sub] skipping, not in development");
    return;
  }

  const { sessionId, userId } = params;
  console.log("[dev-sub] start", { sessionId, userId });

  // Hard guard: Only grant membership for subscription checkouts, not one-time payments
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.mode !== "subscription" || session.status !== "complete") {
      console.log("[dev-sub] skipping devGrantMembershipForSession; non-subscription or incomplete session", {
        sessionId,
        mode: session?.mode,
        status: session?.status,
      });
      return;
    }
  } catch (error) {
    console.error("[dev-sub] failed to retrieve session for guard check", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    // If we can't verify the session, don't grant membership
    return;
  }

  try {
    // 1) Resolve a Plan to attach.
    //    Try to find the "Standard" plan first, then fall back to cheapest plan.
    let plan = await withPrismaRetry(
      () =>
        prisma.plan.findFirst({
          where: { name: "Standard" },
        }),
      "dev-sub-plan-standard"
    );

    if (!plan) {
      // Fallback: find the cheapest plan
      plan = await withPrismaRetry(
        () =>
          prisma.plan.findFirst({
            orderBy: { priceMonthly: "asc" },
          }),
        "dev-sub-plan-cheapest"
      );

      if (!plan) {
        const error = new Error("[dev-sub] no plan found in database, aborting");
        console.error("[dev-sub][ERROR]", error);
        throw error;
      }

      console.log("[dev-sub] Standard plan not found, using cheapest plan", {
        planId: plan.id,
        planName: plan.name,
      });
    }

    // 2) Fake Stripe sub id (so idempotency has a key).
    const fakeStripeSubId = `dev_sub_${userId}_${plan.id}`;

    // 3) Compute start / renew dates (simple: now and +1 month).
    const startDate = new Date();
    const renewsAt = new Date();
    renewsAt.setMonth(renewsAt.getMonth() + 1);

    console.log("[dev-sub] upsert data", {
      fakeStripeSubId,
      userId,
      planId: plan.id,
      planName: plan.name,
      status: "ACTIVE",
      startDate: startDate.toISOString(),
      renewsAt: renewsAt.toISOString(),
    });

    // 4) Check if subscription already exists
    const existing = await withPrismaRetry(
      () =>
        prisma.subscription.findUnique({
          where: { stripeSubId: fakeStripeSubId },
        }),
      "dev-sub-findUnique"
    );

    const isNewSubscription = !existing;

    // 5) Upsert subscription using Prisma upsert
    const subscription = await withPrismaRetry(
      () =>
        prisma.subscription.upsert({
          where: { stripeSubId: fakeStripeSubId },
          update: {
            status: "ACTIVE",
            planId: plan.id,
            userId,
            renewsAt,
          },
          create: {
            userId,
            planId: plan.id,
            stripeSubId: fakeStripeSubId,
            status: "ACTIVE",
            startDate,
            renewsAt,
          },
        }),
      "dev-subscription-create"
    );

    console.log("[dev-sub] subscription upserted", {
      id: subscription.id,
      userId: subscription.userId,
      planId: subscription.planId,
      stripeSubId: subscription.stripeSubId,
      status: subscription.status,
      isNew: isNewSubscription,
    });

    // 6) Grant points only on first creation (idempotency check)
    if (isNewSubscription) {
      // Check if points were already credited for this subscription
      const existingCredit = await withPrismaRetry(
        () =>
          prisma.pointsLedger.findFirst({
            where: {
              userId,
              reason: "SUBSCRIBE_INIT",
              refType: "SUBSCRIPTION",
              refId: fakeStripeSubId,
            },
          }),
        "dev-sub-points-check"
      );

      if (!existingCredit) {
        await credit(userId, 10, "SUBSCRIBE_INIT", "SUBSCRIPTION", fakeStripeSubId);
        console.log("[dev-sub] points credited", { userId, points: 10, stripeSubId: fakeStripeSubId });
      } else {
        console.log("[dev-sub] points already credited, skipping", {
          userId,
          existingCreditId: existingCredit.id,
        });
      }
    }

    // 7) Final verification - query the subscription we just created
    const verifySub = await withPrismaRetry(
      () =>
        prisma.subscription.findUnique({
          where: { stripeSubId: fakeStripeSubId },
          include: { plan: { select: { name: true } } },
        }),
      "dev-sub-verification"
    );

    if (!verifySub) {
      const error = new Error(`[dev-sub] CRITICAL: Subscription was not created! Expected stripeSubId: ${fakeStripeSubId}`);
      console.error("[dev-sub][CRITICAL]", error);
      throw error;
    }

    console.log("[dev-sub] VERIFICATION SUCCESS", {
      subscriptionId: verifySub.id,
      userId: verifySub.userId,
      planId: verifySub.planId,
      planName: verifySub.plan?.name,
      status: verifySub.status,
      stripeSubId: verifySub.stripeSubId,
    });
  } catch (error) {
    console.error("[dev-sub][ERROR]", {
      sessionId,
      userId,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    // Re-throw so we see the failure in server logs
    throw error;
  }
}

