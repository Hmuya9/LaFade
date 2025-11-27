// Test script to debug login issues
import { PrismaClient } from "@prisma/client";
import { compare } from "bcryptjs";

const prisma = new PrismaClient();

async function testLogin() {
  // 👇 CHANGE THESE to match what you're testing
  const testEmail = process.argv[2] || "hussemuya.hm.hm@gmail.com"; // From command line or default
  const testPassword = process.argv[3] || "LaFadeBarberPWD1"; // From command line or default

  console.log("🔍 Testing Login Flow\n");
  console.log("Email:", testEmail);
  console.log("Password:", testPassword);
  console.log("");

  // Step 1: Find user (SQLite is case-sensitive, so we need to handle this)
  console.log("Step 1: Looking up user...");
  const emailLower = testEmail.trim().toLowerCase();
  console.log("   Searching for (lowercase):", emailLower);
  
  // Try exact match first (as stored in DB)
  let user = await prisma.user.findUnique({ where: { email: testEmail.trim() } });
  
  // If not found, try case-insensitive search using findMany
  if (!user) {
    const allUsers = await prisma.user.findMany({
      where: {
        email: {
          contains: emailLower.split("@")[0], // Search by email prefix
        },
      },
    });
    
    // Find the one that matches case-insensitively
    user = allUsers.find(u => u.email?.toLowerCase() === emailLower) || null;
    
    if (allUsers.length > 0 && !user) {
      console.log("   ⚠️  Found similar emails but none match:");
      allUsers.forEach(u => {
        console.log(`      - "${u.email}"`);
      });
    } else if (user) {
      console.log(`   ✅ Found user with email: "${user.email}"`);
    }
  } else {
    console.log(`   ✅ Found user with exact email match`);
  }

  if (!user) {
    console.log("❌ User not found!");
    console.log("   Searched for:", testEmail);
    console.log("   Try checking Prisma Studio for the exact email");
    await prisma.$disconnect();
    return;
  }

  console.log("✅ User found:");
  console.log("   ID:", user.id);
  console.log("   Email:", user.email);
  console.log("   Name:", user.name);
  console.log("   Role:", user.role);
  console.log("");

  // Step 2: Check passwordHash
  if (!user.passwordHash) {
    console.log("❌ No passwordHash found!");
    console.log("   You need to add a passwordHash in Prisma Studio");
    console.log("   Steps:");
    console.log("   1. Open Prisma Studio → User table");
    console.log("   2. Scroll RIGHT to find passwordHash column");
    console.log("   3. Paste a hash (generate with: pnpm hash:generate YourPassword)");
    await prisma.$disconnect();
    return;
  }

  console.log("✅ passwordHash exists");
  console.log("   Hash length:", user.passwordHash.length);
  console.log("   Hash starts with:", user.passwordHash.substring(0, 10));
  console.log("   Hash ends with:", user.passwordHash.substring(user.passwordHash.length - 5));
  
  // Check for common issues
  if (user.passwordHash.length !== 60) {
    console.log("   ⚠️  WARNING: Hash length is not 60!");
    console.log("      Hash might have extra characters (spaces, dots, etc.)");
  }
  
  if (user.passwordHash.endsWith(".") && user.passwordHash.length === 61) {
    console.log("   ⚠️  WARNING: Hash has trailing dot!");
    console.log("      Remove the trailing dot in Prisma Studio");
  }
  
  if (user.passwordHash.includes(" ")) {
    console.log("   ⚠️  WARNING: Hash contains spaces!");
    console.log("      Remove spaces in Prisma Studio");
  }
  
  console.log("");

  // Step 3: Compare password
  console.log("Step 3: Comparing password...");
  try {
    const isValid = await compare(testPassword, user.passwordHash);
    console.log("   Compare result:", isValid);
    
    if (isValid) {
      console.log("✅ Password is VALID!");
      console.log("   Login should work!");
    } else {
      console.log("❌ Password is INVALID!");
      console.log("   The passwordHash doesn't match the password");
      console.log("   Regenerate the hash and update it in Prisma Studio");
    }
  } catch (error) {
    console.log("❌ Error comparing password:", error);
  }

  await prisma.$disconnect();
}

testLogin().catch(console.error);

