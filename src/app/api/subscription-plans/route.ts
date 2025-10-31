import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"

export async function GET() {
  try {
    const prices = await stripe.prices.list({
      active: true,
      expand: ["data.product"],
    })

    const subscriptionPlans = prices.data
      .filter(price => price.recurring)
      .map(price => ({
        id: price.id,
        name: (price.product as any)?.name || "Plan",
        price: price.unit_amount || 0,
        interval: price.recurring?.interval || "month",
      }))

    return NextResponse.json(subscriptionPlans)
  } catch (error) {
    // TODO: Add proper error logging service
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    )
  }
}

