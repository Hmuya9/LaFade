import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    // Try to query the BarberAvailability table
    const count = await prisma.barberAvailability.count();
    console.log("✅ BarberAvailability table exists!");
    console.log(`   Current rows: ${count}`);
  } catch (error: any) {
    if (error.message?.includes("does not exist") || error.code === "P2021") {
      console.error("❌ BarberAvailability table does NOT exist in the database");
      console.error("   Error:", error.message);
      console.log("\n💡 Solution: Run 'pnpm prisma db push' to create the table");
    } else {
      console.error("❌ Error checking table:", error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();




