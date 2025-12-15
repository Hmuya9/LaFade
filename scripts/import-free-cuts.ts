/**
 * Bulk import clients who already received a free cut offline.
 * 
 * This creates User records (if needed) and Appointment records with:
 * - isFree: true
 * - kind: TRIAL_FREE
 * - status: COMPLETED
 * 
 * This makes computeClientFunnel recognize them as having used their free cut,
 * and puts them in the SECOND_WINDOW stage (10 days from the free cut date).
 * 
 * Usage: pnpm import-free-cuts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 👇 EDIT THIS ARRAY with your client data
const FREE_CUT_CLIENTS = [
  {
    email: "test3@gmail.com",
    name: "test3",
    phone: "4255242909",
    barberEmail: "hussemuya.hm.hm@gmail.com", // or null if unknown
    freeCutDate: "2025-12-01", // YYYY-MM-DD format, treated as 12:00 local time
  },
  // Add more entries here...
];

interface FreeCutClient {
  email: string;
  name: string;
  phone: string;
  barberEmail: string | null;
  freeCutDate: string; // YYYY-MM-DD
}

async function importFreeCuts() {
  console.log("🚀 Starting bulk import of free cut clients...\n");

  let usersCreated = 0;
  let usersUpdated = 0;
  let appointmentsCreated = 0;
  let appointmentsSkipped = 0;
  const errors: string[] = [];

  // Get all barbers for lookup
  const allBarbers = await prisma.user.findMany({
    where: { role: "BARBER" },
    select: { id: true, email: true, name: true },
  });

  console.log(`📋 Found ${allBarbers.length} barbers in database`);
  if (allBarbers.length === 0) {
    console.warn("⚠️  WARNING: No barbers found. Appointments will be skipped if barberEmail is provided.");
  }

  // Get a default barber (first one) as fallback
  const defaultBarber = allBarbers[0];

  for (const client of FREE_CUT_CLIENTS) {
    try {
      // 1. Upsert User
      const idempotencyKey = `import-freecut-${client.email}-${client.freeCutDate}`;

      // Parse the free cut date (treat as 12:00 local time)
      const [year, month, day] = client.freeCutDate.split("-").map(Number);
      const startAt = new Date(year, month - 1, day, 12, 0, 0); // month is 0-indexed
      const endAt = new Date(startAt.getTime() + 30 * 60 * 1000); // +30 minutes

      // Find barber
      let barberId: string | null = null;
      if (client.barberEmail) {
        const barber = allBarbers.find((b) => b.email === client.barberEmail);
        if (barber) {
          barberId = barber.id;
        } else {
          console.warn(
            `⚠️  Barber not found: ${client.barberEmail} for client ${client.email}. Using default barber or skipping.`
          );
          if (defaultBarber) {
            barberId = defaultBarber.id;
            console.log(`   → Using default barber: ${defaultBarber.name || defaultBarber.email}`);
          }
        }
      } else if (defaultBarber) {
        barberId = defaultBarber.id;
        console.log(`   → No barber specified for ${client.email}, using default: ${defaultBarber.name || defaultBarber.email}`);
      }

      if (!barberId) {
        console.error(`❌ No barber available for ${client.email}. Skipping appointment.`);
        appointmentsSkipped++;
        errors.push(`No barber for ${client.email}`);
        continue;
      }

      // Upsert user (create or update)
      const existingUser = await prisma.user.findUnique({
        where: { email: client.email },
      });

      let user;
      if (existingUser) {
        // Update existing user (preserve passwordHash if they have one)
        user = await prisma.user.update({
          where: { email: client.email },
          data: {
            name: client.name || existingUser.name,
            phone: client.phone || existingUser.phone,
            role: "CLIENT", // Ensure they're a client
          },
        });
        usersUpdated++;
        console.log(`   ✓ Updated user: ${client.email}`);
      } else {
        // Create new user with a random password hash (they can reset password later)
        // We use a placeholder hash so the field isn't null (some auth flows may expect it)
        const placeholderHash = await bcrypt.hash(
          `placeholder-${Date.now()}-${Math.random()}`,
          10
        );
        user = await prisma.user.create({
          data: {
            email: client.email,
            name: client.name,
            phone: client.phone,
            role: "CLIENT",
            passwordHash: placeholderHash, // Placeholder - user will need to reset password
          },
        });
        usersCreated++;
        console.log(`   ✓ Created user: ${client.email}`);
      }

      // 2. Upsert Appointment (using idempotencyKey to prevent duplicates)
      try {
        const appointment = await prisma.appointment.upsert({
          where: { idempotencyKey },
          update: {
            // If appointment already exists, update it to ensure it's marked as free
            isFree: true,
            kind: "TRIAL_FREE",
            status: "COMPLETED",
            priceCents: 0,
            paidVia: null,
            paymentStatus: "WAIVED", // Free trial is waived
          },
          create: {
            clientId: user.id,
            barberId: barberId,
            type: "SHOP",
            startAt: startAt,
            endAt: endAt,
            status: "COMPLETED",
            isFree: true,
            kind: "TRIAL_FREE",
            priceCents: 0,
            paidVia: null,
            paymentStatus: "WAIVED", // Free trial is waived
            idempotencyKey: idempotencyKey,
          },
        });

        appointmentsCreated++;
        console.log(
          `   ✓ Created/updated appointment for ${client.email} on ${client.freeCutDate}`
        );
      } catch (apptError: any) {
        // If upsert fails due to unique constraint on (barberId, startAt) or (clientId, startAt),
        // log and skip
        if (
          apptError.code === "P2002" ||
          apptError.message?.includes("Unique constraint")
        ) {
          console.warn(
            `   ⚠️  Appointment conflict for ${client.email} on ${client.freeCutDate}. Skipping.`
          );
          appointmentsSkipped++;
        } else {
          throw apptError;
        }
      }
    } catch (error: any) {
      console.error(`❌ Error processing ${client.email}:`, error.message);
      errors.push(`${client.email}: ${error.message}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 IMPORT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Users created: ${usersCreated}`);
  console.log(`Users updated: ${usersUpdated}`);
  console.log(`Appointments created/updated: ${appointmentsCreated}`);
  console.log(`Appointments skipped: ${appointmentsSkipped}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${errors.length}`);
    errors.forEach((err) => console.log(`   - ${err}`));
  } else {
    console.log("\n✅ All imports completed successfully!");
  }

  console.log("\n💡 Next steps:");
  console.log("   1. Verify in Prisma Studio: pnpm db:studio");
  console.log("   2. Check /api/me/funnel for imported clients");
  console.log("   3. Clients should see SECOND_WINDOW stage if within 10 days");
}

// Run the import
importFreeCuts()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("💥 Fatal error:", error);
    await prisma.$disconnect();
    process.exit(1);
  });

