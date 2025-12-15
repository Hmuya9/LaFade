import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { prisma, withPrismaRetry } from "@/lib/db"
import { credit } from "@/lib/points"
import { pusherServer } from "@/lib/pusher"
import Stripe from "stripe"

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Check if Stripe is properly configured
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 501 }
    )
  }

  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json(
      { error: "No signature provided" },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error) {
    // Log signature verification failure (gated for production)
    if (process.env.NODE_ENV !== "production") {
      console.error('[webhook][SIGNATURE_FAILED]', {
        error: error instanceof Error ? error.message : String(error),
        signature: signature.substring(0, 20) + "...", // Log partial signature for debugging
      });
    }
    // TODO: Send to error tracking service in production
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    )
  }

  // Log event received (only in development)
  if (process.env.NODE_ENV !== "production") {
    console.log('[webhook][EVENT_RECEIVED]', {
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session, event.id)
        break

      case "invoice.payment_succeeded":
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(invoice)
        break

      case "invoice.payment_failed":
        const failedInvoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(failedInvoice)
        break

      case "customer.subscription.updated":
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break

      case "customer.subscription.deleted":
        const deletedSubscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(deletedSubscription)
        break

      default:
        // Only log truly unhandled events (not common ones we intentionally skip)
        if (!event.type.startsWith("payment_intent.") && 
            !event.type.startsWith("charge.") &&
            !event.type.startsWith("customer.") &&
            event.type !== "checkout.session.async_payment_succeeded" &&
            event.type !== "checkout.session.async_payment_failed") {
          console.log(`[webhook] Unhandled event type: ${event.type}`)
        }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    // Always log webhook processing errors (critical for debugging)
    console.error('[webhook][ERROR] Webhook processing failed', {
      eventId: event.id,
      eventType: event.type,
      error: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV !== "production" ? (error instanceof Error ? error.stack : undefined) : undefined,
    });
    // TODO: Send to error tracking service in production
    return NextResponse.json(
      { 
        error: "Webhook processing failed",
        eventId: event.id,
        eventType: event.type,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, eventId: string) {
  // Log essential session details
  console.log('[webhook][checkout.session.completed]', {
    sessionId: session.id,
    mode: session.mode,
    customerEmail: session.customer_email,
    hasSubscription: !!session.subscription,
    metadata: session.metadata ?? {},
  });
  
  try {
    // Handle individual appointment payments (mode: "payment")
    if (session.mode === "payment") {
      console.log('[webhook][checkout.session.completed] Payment mode detected, routing to handleAppointmentPayment');
      await handleAppointmentPayment(session)
      return
    }
    
    // Handle subscription payments (mode: "subscription" OR session.subscription is present)
    const stripeSubscriptionId = session.subscription as string
    const customerEmail = session.customer_email
    
    // Ensure subscription branch executes for /plans checkout
    const isSubscriptionCheckout = session.mode === "subscription" || !!stripeSubscriptionId;
    
    if (!isSubscriptionCheckout) {
      return
    }
    
    if (!stripeSubscriptionId) {
      console.error('[webhook][checkout.session.completed] Subscription checkout detected but no subscription ID', {
        sessionId: session.id,
      });
      return
    }
    
    // Read metadata from checkout session (preferred method)
    const metadata = session.metadata ?? {};
    const metaUserId = metadata.userId;
    const metaPlanId = metadata.planId;
    
    // Retrieve the full subscription object from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
    const priceId = stripeSubscription.items.data[0]?.price.id
    
    if (!priceId) {
      console.error('[webhook][checkout.session.completed][ERROR] No price ID found in subscription', {
        sessionId: session.id,
        stripeSubscriptionId,
        items: stripeSubscription.items.data,
      });
      return
    }
    
    // Resolve user: prefer metadata.userId, fall back to email lookup
    let user: { id: string; email: string | null } | null = null;
    
    if (metaUserId) {
      user = await prisma.user.findUnique({
        where: { id: metaUserId }
      });
    }
    
    // Fallback to email-based lookup
    if (!user && customerEmail) {
      user = await prisma.user.findUnique({
        where: { email: customerEmail }
      });
    }
    
    // Try customer_details.email if still no user
    if (!user && session.customer_details?.email) {
      user = await prisma.user.findUnique({
        where: { email: session.customer_details.email }
      });
    }
    
    // Create new user if doesn't exist (only if we have an email)
    if (!user && customerEmail) {
      user = await prisma.user.create({
        data: {
          email: customerEmail,
          role: "CLIENT",
          name: session.customer_details?.name || undefined,
          phone: session.customer_details?.phone || undefined,
        }
      });
    }
    
    // If still no user found, log warning and return (don't throw)
    if (!user) {
      console.warn('[webhook][checkout.session.completed] No user found, skipping subscription creation', {
        sessionId: session.id,
        metaUserId,
        customerEmail,
      });
      return;
    }

    // Credit points for subscription signup (AFTER user is found/created)
    // Use idempotency: check if we already credited for this subscription

    const existingCredit = await prisma.pointsLedger.findFirst({
      where: {
        userId: user.id,
        reason: 'SUBSCRIBE_INIT',
        refType: 'SUBSCRIPTION',
        refId: stripeSubscriptionId,
      }
    })

    if (!existingCredit) {
      await credit(user.id, 10, 'SUBSCRIBE_INIT', 'SUBSCRIPTION', stripeSubscriptionId)
      console.log('[webhook][SUBSCRIPTION_POINTS] Points credited', {
        userId: user.id,
        points: 10,
        stripeSubscriptionId,
      });
    }
    
    // Resolve plan: prefer metadata.planId, fall back to priceId lookup
    let plan: { id: string; name: string; stripePriceId: string } | null = null;
    
    if (metaPlanId) {
      plan = await prisma.plan.findUnique({
        where: { id: metaPlanId }
      });
    }
    
    // Fallback to priceId lookup
    if (!plan && priceId) {
      plan = await prisma.plan.findUnique({
        where: { stripePriceId: priceId }
      });
    }
    
    // If still no plan found, log warning and return (don't throw)
    if (!plan) {
      console.warn('[webhook][checkout.session.completed] No plan found, skipping subscription creation', {
        sessionId: session.id,
        metaPlanId,
        priceId,
      });
      return;
    }
    
    // Calculate renewal date (monthly subscription)
    const renewsAt = new Date((stripeSubscription as any).current_period_end * 1000)
    const startDate = new Date(stripeSubscription.created * 1000);
    const subscriptionStatus = stripeSubscription.status === "active" ? "ACTIVE" : "TRIAL";
    
    // Check if subscription already exists (idempotency for webhook retries)
    const existingSubscription = await withPrismaRetry(
      () =>
        prisma.subscription.findUnique({
          where: { stripeSubId: stripeSubscriptionId },
        }),
      "subscription-findUnique"
    );
    
    const isNewSubscription = !existingSubscription;
    
    // Get or create subscription - ensure we have a non-null subscription object
    let dbSubscription: Awaited<ReturnType<typeof prisma.subscription.create>>;
    
    if (!existingSubscription) {
      // Create subscription in database
      dbSubscription = await withPrismaRetry(
        () =>
          prisma.subscription.create({
            data: {
              userId: user.id,
              planId: plan.id,
              stripeSubId: stripeSubscriptionId,
              status: subscriptionStatus,
              startDate,
              renewsAt,
            }
          }),
        "subscription-create"
      );
      
      console.log('[webhook] Subscription created', {
        subscriptionId: dbSubscription.id,
        userId: user.id,
        planId: plan.id,
        status: dbSubscription.status,
      });
    } else {
      // Update existing subscription (in case webhook is retried)
      dbSubscription = await withPrismaRetry(
        () =>
          prisma.subscription.update({
            where: { id: existingSubscription.id },
            data: {
              status: subscriptionStatus,
              renewsAt,
            }
          }),
        "subscription-update"
      );
      
      console.log('[webhook] Subscription updated', {
        subscriptionId: dbSubscription.id,
        status: dbSubscription.status,
      });
    }
    
    // Create payment record (only for new subscriptions to avoid duplicates)
    if (isNewSubscription) {
      const amount = session.amount_total || 0
      if (amount > 0) {
        await withPrismaRetry(
          () =>
            prisma.payment.create({
              data: {
                userId: user.id,
                stripePaymentId: (session as any).payment_intent || session.id,
                amount,
                kind: "SUBSCRIPTION",
              }
            }),
          "subscription-payment-create"
        )
      }
    }
    
    // Log event (only on creation, not on update)
    if (isNewSubscription) {
      await withPrismaRetry(
        () =>
          prisma.eventLog.create({
            data: {
              type: "subscription.created",
              payload: {
                subscriptionId: dbSubscription.id,
                userId: user.id,
                planId: plan.id,
                stripeSubId: stripeSubscriptionId,
              }
            }
          }),
        "subscription-eventlog-create"
      )
    }
  } catch (error) {
    console.error('[webhook][checkout.session.completed] Error', {
      sessionId: session.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log("Payment succeeded:", invoice.id)
  
  try {
    const stripeSubscriptionId = (invoice as any).subscription as string
    
    if (!stripeSubscriptionId) {
      console.log("Invoice not associated with subscription")
      return
    }
    
    // Find subscription in database
    const subscription = await withPrismaRetry(
      () =>
        prisma.subscription.findUnique({
          where: { stripeSubId: stripeSubscriptionId },
          include: { user: true }
        }),
      "invoice-subscription-findUnique"
    )
    
    if (!subscription) {
      console.error(`Subscription not found: ${stripeSubscriptionId}`)
      return
    }
    
    // Update subscription status to ACTIVE
    await withPrismaRetry(
      () =>
        prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: "ACTIVE",
            renewsAt: new Date((invoice.lines.data[0]?.period.end || 0) * 1000)
          }
        }),
      "invoice-subscription-update"
    )

    // Credit points for subscription renewal
    await credit(subscription.userId, 12, 'RENEWAL', 'INVOICE', invoice.id)
    console.log(`✅ Credited 12 points to user ${subscription.userId} for subscription renewal`)
    
    // Create payment record
    await withPrismaRetry(
      () =>
        prisma.payment.create({
          data: {
            userId: subscription.userId,
            stripePaymentId: (invoice as any).payment_intent || invoice.id,
            amount: invoice.amount_paid,
            kind: "SUBSCRIPTION",
          }
        }),
      "invoice-payment-create"
    )
    
    console.log(`✅ Payment succeeded for subscription: ${subscription.id}`)
    
    // Log event
    await withPrismaRetry(
      () =>
        prisma.eventLog.create({
          data: {
            type: "payment.succeeded",
            payload: {
              subscriptionId: subscription.id,
              invoiceId: invoice.id,
              amount: invoice.amount_paid,
            }
          }
        }),
      "invoice-eventlog-create"
    )
  } catch (error) {
    console.error("Error in handlePaymentSucceeded:", error)
    throw error
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log("Payment failed:", invoice.id)
  
  try {
    const stripeSubscriptionId = (invoice as any).subscription as string
    
    if (!stripeSubscriptionId) {
      console.log("Invoice not associated with subscription")
      return
    }
    
    // Find subscription in database
    const subscription = await withPrismaRetry(
      () =>
        prisma.subscription.findUnique({
          where: { stripeSubId: stripeSubscriptionId }
        }),
      "payment-failed-subscription-findUnique"
    )
    
    if (!subscription) {
      console.error(`Subscription not found: ${stripeSubscriptionId}`)
      return
    }
    
    // Update subscription status to PAST_DUE
    await withPrismaRetry(
      () =>
        prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: "PAST_DUE" }
        }),
      "payment-failed-subscription-update"
    )
    
    console.log(`⚠️ Payment failed for subscription: ${subscription.id}`)
    
    // Log event
    await withPrismaRetry(
      () =>
        prisma.eventLog.create({
          data: {
            type: "payment.failed",
            payload: {
              subscriptionId: subscription.id,
              invoiceId: invoice.id,
              amount: invoice.amount_due,
              attemptCount: invoice.attempt_count,
            }
          }
        }),
      "payment-failed-eventlog-create"
    )
  } catch (error) {
    console.error("Error in handlePaymentFailed:", error)
    throw error
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log("Subscription updated:", subscription.id)
  
  try {
    const dbSubscription = await withPrismaRetry(
      () =>
        prisma.subscription.findUnique({
          where: { stripeSubId: subscription.id }
        }),
      "subscription-updated-findUnique"
    )
    
    if (!dbSubscription) {
      console.error(`Subscription not found: ${subscription.id}`)
      return
    }
    
    // Map Stripe status to our status enum
    let status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED" = "ACTIVE"
    if (subscription.status === "trialing") status = "TRIAL"
    else if (subscription.status === "past_due") status = "PAST_DUE"
    else if (subscription.status === "canceled" || subscription.status === "unpaid") status = "CANCELED"
    
    await withPrismaRetry(
      () =>
        prisma.subscription.update({
          where: { id: dbSubscription.id },
          data: {
            status,
            renewsAt: new Date((subscription as any).current_period_end * 1000)
          }
        }),
      "subscription-updated-update"
    )
    
    console.log(`✅ Subscription updated: ${dbSubscription.id} - status: ${status}`)
  } catch (error) {
    console.error("Error in handleSubscriptionUpdated:", error)
    throw error
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log("Subscription deleted:", subscription.id)
  
  try {
    const dbSubscription = await withPrismaRetry(
      () =>
        prisma.subscription.findUnique({
          where: { stripeSubId: subscription.id }
        }),
      "subscription-deleted-findUnique"
    )
    
    if (!dbSubscription) {
      console.error(`Subscription not found: ${subscription.id}`)
      return
    }
    
    // Mark subscription as CANCELED
    await withPrismaRetry(
      () =>
        prisma.subscription.update({
          where: { id: dbSubscription.id },
          data: { status: "CANCELED" }
        }),
      "subscription-deleted-update"
    )
    
    console.log(`✅ Subscription canceled: ${dbSubscription.id}`)
    
    // Log event
    await withPrismaRetry(
      () =>
        prisma.eventLog.create({
          data: {
            type: "subscription.canceled",
            payload: {
              subscriptionId: dbSubscription.id,
              stripeSubId: subscription.id,
              canceledAt: subscription.canceled_at,
            }
          }
        }),
      "subscription-deleted-eventlog-create"
    )
  } catch (error) {
    console.error("Error in handleSubscriptionDeleted:", error)
    throw error
  }
}

async function handleAppointmentPayment(session: Stripe.Checkout.Session) {
  console.log("Processing appointment payment:", session.id)
  
  try {
    // Extract appointment data from metadata
    const metadata = session.metadata
    if (!metadata) {
      console.error("No metadata found in checkout session")
      return
    }

    const {
      customerName,
      customerEmail,
      selectedDate,
      selectedTime,
      selectedBarber,
      plan,
      kind // Extract kind from metadata (e.g., "DISCOUNT_SECOND")
    } = metadata

    if (!customerName || !customerEmail || !selectedDate || !selectedTime || !selectedBarber || !plan) {
      console.error("Missing required appointment data in metadata")
      return
    }

    // Log kind for debugging
    if (kind === "DISCOUNT_SECOND" || process.env.NODE_ENV === "development") {
      console.log("[webhook] Processing appointment with kind:", kind || "none (defaulting to ONE_OFF)");
    }

    // Find or create client
    let client = await prisma.user.findFirst({ where: { email: customerEmail } })
    if (!client) {
      client = await prisma.user.create({
        data: {
          name: customerName,
          email: customerEmail,
          role: "CLIENT",
        },
      })
    }

    // Find barber by ID (preferred) or name (legacy support)
    let barber = await prisma.user.findUnique({
      where: { id: selectedBarber },
    });
    
    // If not found by ID, try by name (legacy support)
    if (!barber || (barber.role !== "BARBER" && barber.role !== "OWNER")) {
      barber = await prisma.user.findFirst({
        where: { 
          name: selectedBarber, 
          role: { in: ["BARBER", "OWNER"] },
        },
      });
    }
    
    if (!barber || (barber.role !== "BARBER" && barber.role !== "OWNER")) {
      console.error(`Barber not found: ${selectedBarber}`)
      return
    }

    // Parse local date/time and convert to UTC for storage
    const [year, month, day] = selectedDate.split('-').map(Number)
    const [time, period] = selectedTime.split(" ")
    const [hh, mm] = time.split(":")
    let hour = parseInt(hh, 10)
    if (period === "PM" && hour !== 12) hour += 12
    if (period === "AM" && hour === 12) hour = 0
    // Create Date object in local timezone, which JavaScript stores as UTC internally
    const startAtLocal = new Date(year, month - 1, day, hour, parseInt(mm ?? "0", 10), 0, 0)
    const startAtUTC = startAtLocal
    const endAtUTC = new Date(startAtUTC.getTime() + 30 * 60 * 1000) // +30 minutes

    // Determine kind from metadata or fall back to plan-based logic
    // TRIAL_FREE always means isFree = true
    const isTrial = plan === "trial";
    const appointmentKind = (kind as string) || (isTrial ? "TRIAL_FREE" : "ONE_OFF");
    
    // Determine priceCents based on kind
    let priceCents: number | null = null;
    if (appointmentKind === "DISCOUNT_SECOND") {
      priceCents = 1000; // $10 second-cut promo
    } else if (appointmentKind === "TRIAL_FREE") {
      priceCents = 0; // Free trial
    } else if (plan === "standard") {
      priceCents = 4500; // $45 standard cut
    } else if (plan === "deluxe") {
      priceCents = 9000; // $90 deluxe cut
    } else {
      // Fallback: use amount from Stripe session if available
      const amountTotal = session.amount_total;
      if (amountTotal) {
        priceCents = amountTotal;
      }
    }
    
    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        clientId: client.id,
        barberId: barber.id,
        type: plan === "deluxe" ? "HOME" : "SHOP",
        startAt: startAtUTC,
        endAt: endAtUTC,
        status: "BOOKED",
        kind: appointmentKind as any, // Cast to AppointmentKind enum
        isFree: isTrial, // Keep isFree and kind in sync (TRIAL_FREE = true)
        priceCents,
        idempotencyKey: `stripe_${session.id}`,
        // Mark Stripe payments explicitly in appointment metadata
        paidVia: "STRIPE",
        // Payment is completed at this point
        paymentStatus: "PAID",
      },
      include: {
        client: { select: { name: true, email: true, phone: true } },
        barber: { select: { name: true } },
      },
    })

    try {
      await pusherServer.trigger("lafade-bookings", "booking.created", {
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        barberId: appointment.barberId,
        startAt: appointment.startAt,
        type: appointment.type,
        isFree: appointment.isFree,
        // TS: allow createdAt since Prisma type doesn't include it in this include()
        createdAt: (appointment as any).createdAt,
      })
    } catch (error) {
      console.error("Pusher booking.created error", error)
    }

    // Mark availability as booked
    try {
      await prisma.availability.updateMany({
        where: {
          barberName: selectedBarber,
          date: {
            gte: new Date(`${selectedDate}T00:00:00.000Z`),
            lt: new Date(`${selectedDate}T23:59:59.999Z`)
          },
          timeSlot: selectedTime,
          isBooked: false
        },
        data: {
          isBooked: true
        }
      })
      console.log(`✅ Marked availability as booked: ${selectedBarber} on ${selectedDate} at ${selectedTime}`)
    } catch (availabilityError) {
      console.error('Failed to update availability:', availabilityError)
    }

    // Create payment record
    await prisma.payment.create({
      data: {
        userId: client.id,
        stripePaymentId: session.id,
        amount: session.amount_total || 0,
        kind: "ONEOFF",
      }
    })

    // Send confirmation email
    try {
      const { sendBookingEmail } = await import("@/lib/notify")
      const { buildICS } = await import("@/lib/calendar")
      
      // Generate calendar invite
      const icsContent = buildICS({
        title: `${plan === 'trial' ? 'Free Trial' : plan === 'deluxe' ? 'Deluxe Cut' : 'Standard Cut'} - Le Fade`,
        description: `Barber appointment with ${barber.name}`,
        start: startAtUTC,
        end: endAtUTC,
        location: plan === 'deluxe' ? 'Your location' : 'Le Fade Barber Shop',
        organizer: { 
          name: 'Le Fade', 
          email: 'bookings@lefade.com' 
        },
      })

      // Transform appointment to match expected interface with non-null fields
      const appointmentForEmail = {
        ...appointment,
        client: {
          name: appointment.client.name || "Customer",
          email: appointment.client.email || "",
          phone: appointment.client.phone || "",
        },
        barber: {
          name: appointment.barber.name || "Barber",
        },
      };
      
      await sendBookingEmail(appointmentForEmail, 'created', icsContent)
      console.log(`✅ Confirmation email sent to ${customerEmail}`)
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError)
    }

    // Log event
    await prisma.eventLog.create({
      data: {
        type: "appointment.paid",
        payload: {
          appointmentId: appointment.id,
          userId: client.id,
          barberId: barber.id,
          plan,
          amount: session.amount_total || 0,
          stripeSessionId: session.id,
        }
      }
    })

    console.log(`✅ Appointment created and paid: ${appointment.id} for ${customerEmail}`)
  } catch (error) {
    console.error("Error in handleAppointmentPayment:", error)
    throw error
  }
}

