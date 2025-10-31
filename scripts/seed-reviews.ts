import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const sampleReviews = [
  {
    name: "Marcus Johnson",
    rating: 5,
    comment: "Le Fade has completely transformed my grooming routine. The subscription model is genius - no more last-minute booking stress. The barbers are professional and consistent every time.",
    approved: true,
  },
  {
    name: "David Chen",
    rating: 5,
    comment: "As a busy executive, I appreciate the reliability. Same quality cut every month, and the home service option is perfect for my schedule. Worth every penny.",
    approved: true,
  },
  {
    name: "James Rodriguez",
    rating: 4,
    comment: "Great service and convenient booking. The barbers really listen to what you want and deliver consistently. The subscription takes the hassle out of scheduling.",
    approved: true,
  },
  {
    name: "Alex Thompson",
    rating: 5,
    comment: "Professional service with attention to detail. The subscription model is perfect for someone like me who values consistency and quality. Highly recommend!",
    approved: true,
  },
  {
    name: "Michael Brown",
    rating: 4,
    comment: "Excellent barbers and great customer service. The subscription makes it so easy to maintain my look without the usual booking headaches. Very satisfied.",
    approved: true,
  },
]

async function seedReviews() {
  try {
    console.log('🌱 Seeding barbers...')
    
    // Create barbers (upsert to avoid duplicates)
    const mike = await prisma.user.upsert({
      where: { email: 'mike@lefade.com' },
      update: {},
      create: {
        name: 'Mike',
        email: 'mike@lefade.com',
        role: 'BARBER',
      },
    })
    
    const alex = await prisma.user.upsert({
      where: { email: 'alex@lefade.com' },
      update: {},
      create: {
        name: 'Alex',
        email: 'alex@lefade.com',
        role: 'BARBER',
      },
    })
    
    console.log('✅ Created 2 barbers: Mike, Alex')
    
    console.log('🌱 Seeding reviews...')
    
    for (const review of sampleReviews) {
      await prisma.review.create({
        data: review,
      })
    }
    
    console.log('✅ Successfully seeded 5 reviews')
  } catch (error) {
    console.error('❌ Error seeding:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedReviews()

