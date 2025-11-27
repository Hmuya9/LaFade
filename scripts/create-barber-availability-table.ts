import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    // Use raw SQL to create the BarberAvailability table
    // This matches the schema definition
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "BarberAvailability" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "barberId" TEXT NOT NULL,
        "dayOfWeek" INTEGER NOT NULL,
        "startTime" TEXT NOT NULL,
        "endTime" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `;

    // Create indexes
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "BarberAvailability_barberId_dayOfWeek_startTime_endTime_key" 
      ON "BarberAvailability"("barberId", "dayOfWeek", "startTime", "endTime");
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "BarberAvailability_barberId_dayOfWeek_idx" 
      ON "BarberAvailability"("barberId", "dayOfWeek");
    `;

    console.log("✅ BarberAvailability table created successfully!");
    
    // Verify it exists
    const count = await prisma.barberAvailability.count();
    console.log(`   Verified: table exists with ${count} rows`);
  } catch (error: any) {
    console.error("❌ Error creating table:", error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });




