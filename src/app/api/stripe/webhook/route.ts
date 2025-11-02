import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"
import { credit } from "@/lib/points"
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
    // TODO: Add proper error logging service
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
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
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    // TODO: Add proper error logging service
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("Checkout completed:", session.id)
  
  try {
    // Handle individual appointment payments (mode: "payment")
    if (session.mode === "payment") {
      await handleAppointmentPayment(session)
      return
    }
    
    // Handle subscription payments (mode: "subscription")
    const stripeSubscriptionId = session.subscription as string
    const customerEmail = session.customer_email
    const customerId = session.customer as string
    
    if (!stripeSubscriptionId) {
      console.error("No subscription ID in checkout session")
      return
    }

    // Credit points for subscription signup
    if (customerEmail) {
      const user = await prisma.user.findUnique({
        where: { email: customerEmail }
      })
      
      if (user) {
        await credit(user.id, 10, 'SUBSCRIBE_INIT', 'SUBSCRIPTION', stripeSubscriptionId)
        console.log(`✅ Credited 10 points to ${customerEmail} for subscription signup`)
      }
    }
    
    // Retrieve the full subscription object from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
    const priceId = stripeSubscription.items.data[0]?.price.id
    
    if (!priceId) {
      console.error("No price ID found in subscription")
      return
    }
    
    // Find or create the user by email
    let user = customerEmail ? await prisma.user.findUnique({
      where: { email: customerEmail }
    }) : null
    
    if (!user && customerEmail) {
      // Create new user if doesn't exist
      user = await prisma.user.create({
        data: {
          email: customerEmail,
          role: "CLIENT",
          name: session.customer_details?.name || undefined,
          phone: session.customer_details?.phone || undefined,
        }
      })
    }
    
    if (!user) {
      console.error("Could not find or create user for subscription")
      return
    }
    
    // Find the plan by Stripe price ID
    const plan = await prisma.plan.findUnique({
      where: { stripePriceId: priceId }
    })
    
    if (!plan) {
      console.error(`No plan found for price ID: ${priceId}`)
      return
    }
    
    // Calculate renewal date (monthly subscription)
    const renewsAt = new Date((stripeSubscription as any).current_period_end * 1000)
    
    // Create subscription in database
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        stripeSubId: stripeSubscriptionId,
        status: stripeSubscription.status === "active" ? "ACTIVE" : "TRIAL",
        startDate: new Date(stripeSubscription.created * 1000),
        renewsAt,
      }
    })
    
    // Create payment record
    const amount = session.amount_total || 0
    if (amount > 0) {
      await prisma.payment.create({
        data: {
          userId: user.id,
          stripePaymentId: (session as any).payment_intent || session.id,
          amount,
          kind: "SUBSCRIPTION",
        }
      })
    }
    
    console.log(`✅ Subscription created: ${subscription.id} for user ${user.email}`)
    
    // Log event
    await prisma.eventLog.create({
      data: {
        type: "subscription.created",
        payload: {
          subscriptionId: subscription.id,
          userId: user.id,
          planId: plan.id,
          stripeSubId: stripeSubscriptionId,
        }
      }
    })
  } catch (error) {
    console.error("Error in handleCheckoutCompleted:", error)
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
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubId: stripeSubscriptionId },
      include: { user: true }
    })
    
    if (!subscription) {
      console.error(`Subscription not found: ${stripeSubscriptionId}`)
      return
    }
    
    // Update subscription status to ACTIVE
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        renewsAt: new Date((invoice.lines.data[0]?.period.end || 0) * 1000)
      }
    })

    // Credit points for subscription renewal
    await credit(subscription.userId, 12, 'RENEWAL', 'INVOICE', invoice.id)
    console.log(`✅ Credited 12 points to user ${subscription.userId} for subscription renewal`)
    
    // Create payment record
    await prisma.payment.create({
      data: {
        userId: subscription.userId,
        stripePaymentId: (invoice as any).payment_intent || invoice.id,
        amount: invoice.amount_paid,
        kind: "SUBSCRIPTION",
      }
    })
    
    console.log(`✅ Payment succeeded for subscription: ${subscription.id}`)
    
    // Log event
    await prisma.eventLog.create({
      data: {
        type: "payment.succeeded",
        payload: {
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          amount: invoice.amount_paid,
        }
      }
    })
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
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubId: stripeSubscriptionId }
    })
    
    if (!subscription) {
      console.error(`Subscription not found: ${stripeSubscriptionId}`)
      return
    }
    
    // Update subscription status to PAST_DUE
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "PAST_DUE" }
    })
    
    console.log(`⚠️ Payment failed for subscription: ${subscription.id}`)
    
    // Log event
    await prisma.eventLog.create({
      data: {
        type: "payment.failed",
        payload: {
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          amount: invoice.amount_due,
          attemptCount: invoice.attempt_count,
        }
      }
    })
  } catch (error) {
    console.error("Error in handlePaymentFailed:", error)
    throw error
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log("Subscription updated:", subscription.id)
  
  try {
    const dbSubscription = await prisma.subscription.findUnique({
      where: { stripeSubId: subscription.id }
    })
    
    if (!dbSubscription) {
      console.error(`Subscription not found: ${subscription.id}`)
      return
    }
    
    // Map Stripe status to our status enum
    let status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED" = "ACTIVE"
    if (subscription.status === "trialing") status = "TRIAL"
    else if (subscription.status === "past_due") status = "PAST_DUE"
    else if (subscription.status === "canceled" || subscription.status === "unpaid") status = "CANCELED"
    
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status,
        renewsAt: new Date((subscription as any).current_period_end * 1000)
      }
    })
    
    console.log(`✅ Subscription updated: ${dbSubscription.id} - status: ${status}`)
  } catch (error) {
    console.error("Error in handleSubscriptionUpdated:", error)
    throw error
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log("Subscription deleted:", subscription.id)
  
  try {
    const dbSubscription = await prisma.subscription.findUnique({
      where: { stripeSubId: subscription.id }
    })
    
    if (!dbSubscription) {
      console.error(`Subscription not found: ${subscription.id}`)
      return
    }
    
    // Mark subscription as CANCELED
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: { status: "CANCELED" }
    })
    
    console.log(`✅ Subscription canceled: ${dbSubscription.id}`)
    
    // Log event
    await prisma.eventLog.create({
      data: {
        type: "subscription.canceled",
        payload: {
          subscriptionId: dbSubscription.id,
          stripeSubId: subscription.id,
          canceledAt: subscription.canceled_at,
        }
      }
    })
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
      plan
    } = metadata

    if (!customerName || !customerEmail || !selectedDate || !selectedTime || !selectedBarber || !plan) {
      console.error("Missing required appointment data in metadata")
      return
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

    // Find barber
    const barber = await prisma.user.findFirst({
      where: { name: selectedBarber, role: "BARBER" },
    })
    if (!barber) {
      console.error(`Barber not found: ${selectedBarber}`)
      return
    }

    // Parse appointment time
    const startAt = new Date(selectedDate)
    const [time, period] = selectedTime.split(" ")
    const [hh, mm] = time.split(":")
    let hour = parseInt(hh, 10)
    if (period === "PM" && hour !== 12) hour += 12
    if (period === "AM" && hour === 12) hour = 0
    startAt.setHours(hour, parseInt(mm ?? "0", 10), 0, 0)
    const startAtUTC = new Date(startAt.toISOString())
    const endAtUTC = new Date(startAtUTC.getTime() + 30 * 60 * 1000) // +30 minutes

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        clientId: client.id,
        barberId: barber.id,
        type: plan === "deluxe" ? "HOME" : "SHOP",
        startAt: startAtUTC,
        endAt: endAtUTC,
        status: "BOOKED",
        isFree: plan === "trial",
        idempotencyKey: `stripe_${session.id}`,
      },
      include: {
        client: { select: { name: true, email: true, phone: true } },
        barber: { select: { name: true } },
      },
    })

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

