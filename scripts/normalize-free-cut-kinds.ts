/**
 * Migration script to normalize old free cut appointments.
 * 
 * Sets kind = "TRIAL_FREE" for appointments where:
 * - priceCents = 0
 * - kind IS NULL
 * 
 * This ensures legacy free cuts are properly marked as TRIAL_FREE,
 * which allows them to be detected by isFreeCutAppointment().
 * 
 * Run with: pnpm tsx scripts/normalize-free-cut-kinds.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("[normalize-free-cut-kinds] Starting migration...");

  // Find appointments that are free (priceCents = 0) but have null kind
  const appointmentsToFix = await prisma.appointment.findMany({
    where: {
      priceCents: 0,
      kind: null,
    },
    select: {
      id: true,
      clientId: true,
      kind: true,
      priceCents: true,
      status: true,
      startAt: true,
      isFree: true,
    },
  });

  console.log(`[normalize-free-cut-kinds] Found ${appointmentsToFix.length} appointments to normalize`);

  if (appointmentsToFix.length === 0) {
    console.log("[normalize-free-cut-kinds] No appointments to fix. Exiting.");
    return;
  }

  // Log what we're about to fix
  console.log("[normalize-free-cut-kinds] Appointments to normalize:", appointmentsToFix.map(a => ({
    id: a.id,
    currentKind: a.kind,
    priceCents: a.priceCents,
    status: a.status,
    isFree: a.isFree,
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
          kind: "TRIAL_FREE",
          // Also ensure isFree is true for consistency
          isFree: true,
        },
      });
      fixed++;
      console.log(`[normalize-free-cut-kinds] ✅ Normalized appointment ${appointment.id}`);
    } catch (error) {
      errors++;
      console.error(`[normalize-free-cut-kinds] ❌ Failed to normalize appointment ${appointment.id}:`, error);
    }
  }

  console.log(`[normalize-free-cut-kinds] Migration complete:`);
  console.log(`  - Normalized: ${fixed}`);
  console.log(`  - Errors: ${errors}`);
  console.log(`  - Total: ${appointmentsToFix.length}`);
}

main()
  .catch((error) => {
    console.error("[normalize-free-cut-kinds] Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });







