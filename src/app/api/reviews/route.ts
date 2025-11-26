import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { z } from "zod"

export const runtime = "nodejs";

const createReviewSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  comment: z.string().min(1, "Comment is required").max(500, "Comment too long"),
})

export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      where: { approved: true },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    })

    return NextResponse.json(
      { reviews },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    )
  } catch (error) {
    console.error("Reviews GET error:", error)
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createReviewSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      )
    }
    
    const validatedData = parsed.data

    const review = await prisma.review.create({
      data: {
        name: validatedData.name,
        rating: validatedData.rating,
        comment: validatedData.comment,
        approved: false, // Default to false for moderation
      },
      select: {
        id: true,
        name: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ review }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Reviews POST error:", error)
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    )
  }
}
