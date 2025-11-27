// Normalize all emails in database to lowercase
// This fixes the case-sensitivity issue permanently
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function normalizeEmails() {
  console.log("🔄 Normalizing all emails to lowercase...\n");

  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
      },
    });

    console.log(`Found ${users.length} user(s)\n`);

    let updated = 0;
    let skipped = 0;

    for (const user of users) {
      if (!user.email) {
        console.log(`⚠️  User ${user.id} has no email, skipping`);
        skipped++;
        continue;
      }

      const normalizedEmail = user.email.toLowerCase().trim();

      // Only update if email needs normalization
      if (user.email !== normalizedEmail) {
        console.log(`Updating: "${user.email}" → "${normalizedEmail}"`);
        
        await prisma.user.update({
          where: { id: user.id },
          data: { email: normalizedEmail },
        });
        
        updated++;
      } else {
        console.log(`✓ Already normalized: "${user.email}"`);
        skipped++;
      }
    }

    console.log("\n✅ Normalization complete!");
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log("\n💡 All emails are now lowercase - login should work!");

  } catch (error) {
    console.error("❌ Error normalizing emails:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

normalizeEmails().catch(console.error);




