import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const target = (process.env.BARBER_NAME ?? "CKENZO").trim();

  console.log(`🔄 Normalizing all availability records to barberName='${target}'`);

  // First, get all existing records that don't match the target name (case-sensitive for SQLite)
  const existingRecords = await prisma.availability.findMany({
    where: {
      NOT: {
        barberName: target
      }
    }
  });

  console.log(`📋 Found ${existingRecords.length} records to normalize`);

  if (existingRecords.length === 0) {
    console.log(`✅ All records already use barberName='${target}'`);
    return;
  }

  // Delete existing records and recreate with correct barber name
  let normalizedCount = 0;
  for (const record of existingRecords) {
    try {
      // Check if a record with the target barber name already exists for this date/time
      const existing = await prisma.availability.findUnique({
        where: {
          barberName_date_timeSlot: {
            barberName: target,
            date: record.date,
            timeSlot: record.timeSlot
          }
        }
      });

      if (existing) {
        // Just delete the old record since we already have one with the correct name
        await prisma.availability.delete({
          where: { id: record.id }
        });
        console.log(`🗑️  Removed duplicate: ${record.barberName} -> ${target} for ${record.date.toISOString().split('T')[0]} ${record.timeSlot}`);
      } else {
        // Update the record to use the correct barber name
        await prisma.availability.update({
          where: { id: record.id },
          data: { barberName: target }
        });
        console.log(`✅ Updated: ${record.barberName} -> ${target} for ${record.date.toISOString().split('T')[0]} ${record.timeSlot}`);
        normalizedCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing record ${record.id}:`, error);
    }
  }

  console.log(`✅ Normalized ${normalizedCount} availability rows to barberName='${target}'`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
