import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Deleting duplicate plans with test price IDs...");
  
  // Delete plans with test price IDs (the ones that start with price_1Sa...)
  const testPriceIds = [
    "price_1SaUJyBfxr2OXaLCg8Iukmaj", // Standard test
    "price_1SaUKWBfxr2OXaLC3CEn5nep", // Deluxe test
  ];
  
  for (const priceId of testPriceIds) {
    const result = await prisma.plan.deleteMany({
      where: { stripePriceId: priceId },
    });
    console.log(`Deleted ${result.count} plan(s) with priceId: ${priceId}`);
  }
  
  // Verify what's left
  const remaining = await prisma.plan.findMany();
  console.log("\nRemaining plans:");
  console.log(JSON.stringify(remaining, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());


