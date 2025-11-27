import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const email = process.argv[2] || "admin@example.com";
  const newPassword = process.argv[3] || "Password123!";

  if (!newPassword) {
    console.error("❌ Error: Please provide a password");
    console.log("Usage: tsx scripts/update-admin-password.ts [email] [newPassword]");
    process.exit(1);
  }

  console.log(`🔐 Updating password for: ${email}`);

  // Hash the new password
  const passwordHash = await bcrypt.hash(newPassword, 10);
  console.log("✅ Password hashed");

  // Check if user exists first
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!existingUser) {
    console.error(`❌ Error: User with email ${email} not found in database`);
    console.log("\nAvailable users:");
    const allUsers = await prisma.user.findMany({
      select: { email: true, name: true, role: true },
    });
    allUsers.forEach((u) => {
      console.log(`  - ${u.email} (${u.name || "no name"}) - ${u.role}`);
    });
    process.exit(1);
  }

  // Update the user
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash },
  });

  console.log(`✅ Password updated successfully for ${user.name || email}`);
  console.log(`📝 New password: ${newPassword}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });

