// Test the exact authorize() logic to see what's happening
import { PrismaClient } from "@prisma/client";
import { compare } from "bcryptjs";

const prisma = new PrismaClient();

async function testAuthorizeLogic() {
  const testEmail = process.argv[2] || "hussemuya.hm.hm@gmail.com";
  const testPassword = process.argv[3] || "LaFadeOwner123";

  console.log("🧪 Testing authorize() logic\n");
  console.log("Email:", testEmail);
  console.log("Password:", testPassword);
  console.log("");

  const rawEmail = testEmail.trim();
  const password = testPassword;
  const normalizedEmail = rawEmail.toLowerCase();

  console.log("Step 1: Normalize email");
  console.log(`  Raw: "${rawEmail}"`);
  console.log(`  Normalized: "${normalizedEmail}"`);
  console.log("");

  // Step 1: Try exact lowercase match
  console.log("Step 2: Try exact lowercase match...");
  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (user) {
    console.log("✅ Found with exact match!");
    console.log(`  Email in DB: "${user.email}"`);
  } else {
    console.log("❌ Not found with exact match");
    console.log("");

    // Step 2: Case-insensitive search
    console.log("Step 3: Trying case-insensitive search...");
    const emailPrefix = normalizedEmail.split("@")[0];
    console.log(`  Searching for prefix: "${emailPrefix}"`);
    
    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: emailPrefix,
        },
      },
    });

    console.log(`  Found ${users.length} user(s) with prefix "${emailPrefix}"`);
    
    if (users.length > 0) {
      console.log("  Users found:");
      users.forEach(u => {
        const matches = u.email?.toLowerCase() === normalizedEmail;
        console.log(`    - "${u.email}" (matches: ${matches ? "✅" : "❌"})`);
      });
    }

    user = users.find(u => u.email?.toLowerCase() === normalizedEmail) || null;

    if (user) {
      console.log(`✅ Found with case-insensitive search!`);
      console.log(`  Email in DB: "${user.email}"`);
    } else {
      console.log("❌ Not found with case-insensitive search either");
      console.log("");
      console.log("🔍 Let's check all users in database:");
      const allUsers = await prisma.user.findMany({
        select: { email: true, name: true },
      });
      allUsers.forEach(u => {
        console.log(`  - "${u.email}" (name: ${u.name || "null"})`);
      });
      await prisma.$disconnect();
      return;
    }
  }

  console.log("");
  console.log("Step 4: Check passwordHash...");
  if (!user.passwordHash) {
    console.log("❌ No passwordHash!");
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ passwordHash exists (length: ${user.passwordHash.length})`);
  console.log("");

  console.log("Step 5: Compare password...");
  const isValid = await compare(password, user.passwordHash);
  console.log(`Result: ${isValid ? "✅ MATCH" : "❌ NO MATCH"}`);

  if (isValid) {
    console.log("");
    console.log("✅ authorize() would return user object");
    console.log("   Login should work!");
  } else {
    console.log("");
    console.log("❌ Password doesn't match");
    console.log("   Regenerate hash: pnpm hash:generate YourPassword");
  }

  await prisma.$disconnect();
}

testAuthorizeLogic().catch(console.error);




