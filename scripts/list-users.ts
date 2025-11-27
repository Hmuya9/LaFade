// List all users in the database to find exact emails
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function listUsers() {
  console.log("📋 All Users in Database\n");
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
    },
    orderBy: {
      email: "asc",
    },
  });

  if (users.length === 0) {
    console.log("❌ No users found in database");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${users.length} user(s):\n`);

  users.forEach((user, index) => {
    console.log(`${index + 1}. Email: "${user.email}"`);
    console.log(`   Name: ${user.name || "(null)"}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Has passwordHash: ${user.passwordHash ? "✅ Yes" : "❌ No"}`);
    if (user.passwordHash) {
      console.log(`   Hash length: ${user.passwordHash.length} ${user.passwordHash.length !== 60 ? "⚠️ (should be 60)" : "✅"}`);
    }
    console.log("");
  });

  console.log("💡 To test login with a specific user:");
  console.log(`   pnpm tsx scripts/test-login.ts "exact@email.com" YourPassword`);
  console.log("");

  await prisma.$disconnect();
}

listUsers().catch(console.error);




