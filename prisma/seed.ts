import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Get barber email from environment or use default
  const barberEmail = process.env.BARBER_EMAIL || "barber@example.com"
  const barberName = barberEmail.split('@')[0] // Use email prefix as name

  // Ensure barber user exists
  const barber = await prisma.user.upsert({
    where: { email: barberEmail },
    update: { role: "BARBER", name: barberName },
    create: {
      name: barberName,
      email: barberEmail,
      role: "BARBER"
    }
  })

  console.log(`✅ Created barber: ${barberName} (${barber.id})`)

  // Clear existing availability data for this barber
  await prisma.availability.deleteMany({
    where: {
      barberName: barberName,
      date: {
        gte: new Date("2025-10-20T00:00:00.000Z"),
        lt: new Date("2025-10-22T00:00:00.000Z")
      }
    }
  })
  
  // Create availability data for fixed future dates (using UTC)
  const d1 = new Date("2025-10-20T00:00:00.000Z")
  const d2 = new Date("2025-10-21T00:00:00.000Z")

  const withTime = (d: Date, hh: number, mm: number) => {
    const x = new Date(d)
    x.setUTCHours(hh, mm, 0, 0)
    return x
  }

  const availabilityData = [
    // Day 1 (2025-10-20)
    { barberName: barberName, date: withTime(d1, 9, 0), timeSlot: "09:00" },
    { barberName: barberName, date: withTime(d1, 10, 0), timeSlot: "10:00" },
    { barberName: barberName, date: withTime(d1, 11, 0), timeSlot: "11:00" },
    { barberName: barberName, date: withTime(d1, 14, 0), timeSlot: "14:00" },
    { barberName: barberName, date: withTime(d1, 15, 0), timeSlot: "15:00" },
    // Day 2 (2025-10-21)
    { barberName: barberName, date: withTime(d2, 9, 0), timeSlot: "09:00" },
    { barberName: barberName, date: withTime(d2, 10, 0), timeSlot: "10:00" },
    { barberName: barberName, date: withTime(d2, 14, 0), timeSlot: "14:00" },
    { barberName: barberName, date: withTime(d2, 15, 0), timeSlot: "15:00" },
  ]
  
  await prisma.availability.createMany({
    data: availabilityData,
  })
  
  console.log(`✅ Seeded ${availabilityData.length} Availability records for ${barberName}`)
  console.log(`📅 Dates: 2025-10-20 (${availabilityData.filter(a => a.date.getUTCDate() === 20).length} slots), 2025-10-21 (${availabilityData.filter(a => a.date.getUTCDate() === 21).length} slots)`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
