import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDates() {
  const data = await prisma.availability.findMany({
    select: { barberName: true, date: true, timeSlot: true },
    orderBy: { date: 'asc' }
  })
  
  console.log('Seeded dates:')
  const dates = [...new Set(data.map(d => d.date.toISOString().split('T')[0]))]
  console.log(dates)
  
  await prisma.$disconnect()
}

checkDates().catch(console.error)
