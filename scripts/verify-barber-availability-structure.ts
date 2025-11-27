import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    // Get table structure via raw SQL
    const result = await prisma.$queryRaw<Array<{ name: string; type: string }>>`
      PRAGMA table_info("BarberAvailability");
    `;

    console.log("✅ BarberAvailability table structure:");
    result.forEach(col => {
      console.log(`   - ${col.name}: ${col.type}`);
    });

    // Verify indexes
    const indexes = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='BarberAvailability';
    `;

    console.log("\n✅ Indexes:");
    indexes.forEach(idx => {
      console.log(`   - ${idx.name}`);
    });

    // Test a query
    const count = await prisma.barberAvailability.count();
    console.log(`\n✅ Table is queryable: ${count} rows`);

  } catch (error: any) {
    console.error("❌ Error:", error.message);
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




