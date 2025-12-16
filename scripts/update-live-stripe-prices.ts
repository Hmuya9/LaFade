import { PrismaClient } from "@prisma/client";

/**
 * One-time helper script to update existing Plan rows
 * to use LIVE Stripe price IDs.
 *
 * IMPORTANT:
 * - This script does NOT change schema or migrations.
 * - It only updates existing rows by `name`.
 * - Replace the placeholder price IDs below before running.
 *
 * Usage (from /web):
 *   pnpm ts-node scripts/update-live-stripe-prices.ts
 */

const prisma = new PrismaClient();

// LIVE Stripe price IDs (from environment config)
const PRICE_STANDARD = "price_1SeDclBm4PlsknHdYyQmZXf0";
const PRICE_DELUXE = "price_1SebifBm4PlsknHdz11rE2Yc";
const PRICE_SECOND_CUT = "price_1SeDeWBm4PlsknHd9F06RuzV";

async function main() {
  console.log("[update-live-stripe-prices] Starting update...");

  // Map of plan name -> live priceId
  const updates: { name: string; stripePriceId: string }[] = [
    { name: "Standard", stripePriceId: PRICE_STANDARD },
    { name: "Deluxe", stripePriceId: PRICE_DELUXE },
    { name: "Second Cut", stripePriceId: PRICE_SECOND_CUT },
  ];

  for (const { name, stripePriceId } of updates) {
    if (!stripePriceId || stripePriceId === "REPLACE_ME") {
      console.warn(
        `[update-live-stripe-prices] Skipping "${name}" because priceId is still a placeholder.`
      );
      continue;
    }

    console.log(
      `[update-live-stripe-prices] Updating plan "${name}" with live priceId (prefix):`,
      stripePriceId.slice(0, 8)
    );

    const result = await prisma.plan.updateMany({
      where: { name },
      data: { stripePriceId },
    });

    console.log(
      `[update-live-stripe-prices] "${name}" rows matched: ${result.count}`
    );
  }

  console.log("[update-live-stripe-prices] Done.");
}

main()
  .catch((error) => {
    console.error("[update-live-stripe-prices] ERROR:", {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });


