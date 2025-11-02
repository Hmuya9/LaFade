import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { redisGet, redisSet } from "@/lib/redis"
import dayjs from "dayjs"

export const runtime = "nodejs";

export async function GET() {
  try {
    // Check if database is accessible
    if (!process.env.DATABASE_URL) {
      // Return zeroed metrics when DB not configured
      return NextResponse.json({
        kpis: {
          activeMembers: 0,
          mrr: 0,
          bookingsThisWeek: 0,
          completionRate: 0,
          churn30: 0,
          trials7: 0,
          revenue30: 0,
          costs: 0,
          profit: 0,
          breakdown: {
            baseCost: 0,
            standardCost: 0,
            deluxeCost: 0,
            bonusCost: 0,
            opsCost: 0,
          },
        },
      })
    }

    // Check cache first (optional - gracefully handles missing Redis)
    const cacheKey = "admin:metrics:v1"
    const cached = await redisGet<any>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }
    const now = dayjs()
    const startWeek = now.startOf("week").toDate()
    const endWeek = now.endOf("week").toDate()
    const start30 = now.subtract(30, "day").toDate()

    // Active members & MRR
    const activeSubs = await prisma.subscription.findMany({
      where: { status: { in: ["TRIAL", "ACTIVE"] } },
      include: { plan: true },
    })

    const activeMembers = activeSubs.length
    const mrr = activeSubs.reduce((sum: number, s: any) => sum + (s.plan?.priceMonthly ?? 0), 0)

    // Appointments this week
    const apptsWeek = await prisma.appointment.findMany({
      where: { 
        startAt: { gte: startWeek, lte: endWeek } 
      },
      select: { status: true, type: true, isFree: true },
    })

    const completed = apptsWeek.filter((a: any) => a.status === "COMPLETED").length
    const noShows = apptsWeek.filter((a: any) => a.status === "NO_SHOW").length
    const completionRate = completed + noShows > 0 ? completed / (completed + noShows) : 1

    // Churn (last 30d)
    const canceled30 = await prisma.subscription.count({
      where: { 
        status: "CANCELED", 
        renewsAt: { gte: start30 } 
      },
    })

    const members30Ago = await prisma.subscription.count({
      where: { 
        status: { in: ["TRIAL", "ACTIVE"] }, 
        startDate: { lte: start30 } 
      },
    })

    const churn30 = members30Ago > 0 ? canceled30 / members30Ago : 0

    // Trials (7d)
    const trials7 = await prisma.subscription.count({
      where: { 
        status: "TRIAL", 
        startDate: { gte: dayjs().subtract(7, "day").toDate() } 
      },
    })

    // Revenue (last 30d) - simplified for MVP
    const invoices = await stripe.invoices.list({ 
      limit: 100, 
      status: "paid" 
    })

    const revenue30 = invoices.data
      .filter(inv => dayjs(inv.status_transitions?.paid_at! * 1000).isAfter(start30))
      .reduce((sum, inv) => sum + (inv.total ?? 0), 0)

    // Costs calculation (corrected model)
    const barbers = await prisma.user.count({ where: { role: "BARBER" } })
    const weeks30 = 4 // rough estimate
    const baseCost = barbers * weeks30 * 60_00 // $60/week in cents

    // Get customer counts by plan type
    const standardCustomers = await prisma.subscription.count({
      where: { 
        plan: { name: "Standard" },
        status: { in: ["TRIAL", "ACTIVE"] }
      },
    })

    const deluxeCustomers = await prisma.subscription.count({
      where: { 
        plan: { name: "Deluxe" },
        status: { in: ["TRIAL", "ACTIVE"] }
      },
    })

    const standardCost = standardCustomers * 30_00 // $30 per Standard customer
    const deluxeCost = deluxeCustomers * 22_50 // $22.50 per Deluxe customer

    const freeCuts30 = await prisma.appointment.count({
      where: { 
        isFree: true, 
        startAt: { gte: start30 } 
      },
    })

    const bonusCost = freeCuts30 * 10_00 // $10 per free cut estimate
    const opsCost = 50_00 // $50/month tools estimate

    const costs = baseCost + standardCost + deluxeCost + bonusCost + opsCost
    const profit = revenue30 - costs

    const result = {
      kpis: {
        activeMembers,
        mrr,
        bookingsThisWeek: apptsWeek.length,
        completionRate,
        churn30,
        trials7,
        revenue30,
        costs,
        profit,
        breakdown: {
          baseCost,
          standardCost,
          deluxeCost,
          bonusCost,
          opsCost,
        },
      },
    }

    // Cache for 120 seconds (optional - gracefully fails if Redis unavailable)
    await redisSet(cacheKey, result, 120)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Admin metrics error:", error)
    // Return zeroed metrics instead of 500 error
    return NextResponse.json({
      kpis: {
        activeMembers: 0,
        mrr: 0,
        bookingsThisWeek: 0,
        completionRate: 0,
        churn30: 0,
        trials7: 0,
        revenue30: 0,
        costs: 0,
        profit: 0,
        breakdown: {
          baseCost: 0,
          standardCost: 0,
          deluxeCost: 0,
          bonusCost: 0,
          opsCost: 0,
        },
      },
    })
  }
}

