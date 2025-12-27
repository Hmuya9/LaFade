/**
 * Migration script to fix any DISCOUNT_SECOND appointments that were incorrectly
 * stored as ONE_OFF (e.g., from before the kind field was properly set).
 * 
 * This script:
 * 1. Finds appointments with priceCents === 1000 and kind === "ONE_OFF" (or null)
 * 2. Updates them to kind === "DISCOUNT_SECOND"
 * 
 * Run with: pnpm tsx scripts/fix-discount-second-appointments.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("[fix-discount-second-appointments] Starting migration...");

  // Find appointments that look like DISCOUNT_SECOND but are stored as ONE_OFF or null
  const appointmentsToFix = await prisma.appointment.findMany({
    where: {
      priceCents: 1000, // $10 second-cut promo
      OR: [
        { kind: "ONE_OFF" },
        { kind: null },
      ],
      status: {
        not: "CANCELED", // Only fix non-canceled appointments
      },
    },
    select: {
      id: true,
      clientId: true,
      kind: true,
      priceCents: true,
      status: true,
      startAt: true,
    },
  });

  console.log(`[fix-discount-second-appointments] Found ${appointmentsToFix.length} appointments to fix`);

  if (appointmentsToFix.length === 0) {
    console.log("[fix-discount-second-appointments] No appointments to fix. Exiting.");
    return;
  }

  // Log what we're about to fix
  console.log("[fix-discount-second-appointments] Appointments to fix:", appointmentsToFix.map(a => ({
    id: a.id,
    currentKind: a.kind,
    priceCents: a.priceCents,
    status: a.status,
    startAt: a.startAt.toISOString(),
  })));

  // Update each appointment
  let fixed = 0;
  let errors = 0;

  for (const appointment of appointmentsToFix) {
    try {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          kind: "DISCOUNT_SECOND",
        },
      });
      fixed++;
      console.log(`[fix-discount-second-appointments] ✅ Fixed appointment ${appointment.id}`);
    } catch (error) {
      errors++;
      console.error(`[fix-discount-second-appointments] ❌ Failed to fix appointment ${appointment.id}:`, error);
    }
  }

  console.log(`[fix-discount-second-appointments] Migration complete:`);
  console.log(`  - Fixed: ${fixed}`);
  console.log(`  - Errors: ${errors}`);
  console.log(`  - Total: ${appointmentsToFix.length}`);
}

main()
  .catch((error) => {
    console.error("[fix-discount-second-appointments] Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });







