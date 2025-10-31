import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createErrorResponse } from "@/lib/error"
import { rateLimit, getClientIP } from "@/lib/rate-limit"

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
    const { 
      priceId, 
      appointmentData 
    } = await request.json()

    if (!priceId && !appointmentData) {
      return NextResponse.json(
        { error: "Price ID or appointment data is required" },
        { status: 400 }
      )
    }

    // Handle individual appointment payments (non-subscription)
    if (appointmentData) {
      const { customerName, customerEmail, selectedDate, selectedTime, selectedBarber, plan } = appointmentData
      
      if (!customerName || !customerEmail || !selectedDate || !selectedTime || !selectedBarber || !plan) {
        return NextResponse.json(
          { error: "Missing required appointment data" },
          { status: 400 }
        )
      }

      // Calculate amount based on plan (trial is free)
      let amount = 0
      if (plan === "standard") amount = 3999 // $39.99
      if (plan === "deluxe") amount = 6000   // $60.00
      // trial = 0 (free)

      if (amount === 0) {
        // For free trials, redirect to success page without payment
        return NextResponse.json({ 
          url: `${process.env.NEXT_PUBLIC_APP_URL}/booking?success=true&plan=trial&barber=${selectedBarber}&date=${selectedDate}&time=${selectedTime}&email=${customerEmail}` 
        })
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${plan === "deluxe" ? "Deluxe" : "Standard"} Cut with ${selectedBarber}`,
                description: `Appointment on ${selectedDate} at ${selectedTime}`,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        customer_email: customerEmail,
        metadata: {
          customerName,
          customerEmail,
          selectedDate,
          selectedTime,
          selectedBarber,
          plan,
        },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/booking?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/booking?canceled=true`,
      })

      return NextResponse.json({ url: session.url })
    }

    // Handle subscription payments (legacy support)
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/plans?canceled=true`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    return createErrorResponse(error)
  }
}

