import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createBarbers() {
  // Create Mike barber
  await prisma.user.upsert({
    where: { email: 'mike@lefade.com' },
    update: { role: 'BARBER', name: 'Mike' },
    create: {
      name: 'Mike',
      role: 'BARBER',
      email: 'mike@lefade.com'
    }
  })

  // Create Alex barber
  await prisma.user.upsert({
    where: { email: 'alex@lefade.com' },
    update: { role: 'BARBER', name: 'Alex' },
    create: {
      name: 'Alex',
      role: 'BARBER',
      email: 'alex@lefade.com'
    }
  })

  console.log('✅ Created barbers Mike and Alex')
  await prisma.$disconnect()
}

createBarbers().catch(console.error)
