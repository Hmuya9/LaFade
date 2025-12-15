// Diagnostic script to check authentication issues
import { prisma } from "../src/lib/db";

async function diagnose() {
  console.log("=== Authentication Diagnostic ===\n");

  try {
    // 1. Test database connection
    console.log("1. Testing database connection...");
    await prisma.$connect();
    console.log("✅ Database connection successful\n");

    // 2. Check if user exists
    console.log("2. Checking for user: test33@gmail.com");
    const normalizedEmail = "test33@gmail.com".trim().toLowerCase();
    
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    if (!user) {
      console.log("❌ User NOT found in database");
      
      // Try case-insensitive search
      console.log("\n3. Trying case-insensitive search...");
      const allUsers = await prisma.user.findMany({
        where: {
          email: {
            contains: "test33",
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          passwordHash: true,
        },
      });
      
      if (allUsers.length > 0) {
        console.log(`Found ${allUsers.length} user(s) with similar email:`);
        allUsers.forEach((u) => {
          console.log(`  - ${u.email} (id: ${u.id}, role: ${u.role})`);
        });
      } else {
        console.log("No users found with 'test33' in email");
      }
      
      // List all users
      console.log("\n4. Listing all users in database...");
      const allUsersList = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          passwordHash: true,
        },
        take: 10,
      });
      
      console.log(`Found ${allUsersList.length} user(s) in database:`);
      allUsersList.forEach((u) => {
        const hasPassword = !!u.passwordHash;
        console.log(`  - ${u.email || "(no email)"} (id: ${u.id}, role: ${u.role}, hasPassword: ${hasPassword})`);
      });
    } else {
      console.log("✅ User found!");
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.name || "(none)"}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Has Password Hash: ${!!user.passwordHash}`);
      if (user.passwordHash) {
        console.log(`   Password Hash Length: ${user.passwordHash.length}`);
        console.log(`   Password Hash Prefix: ${user.passwordHash.slice(0, 10)}...`);
        console.log(`   Password Hash Format Valid: ${user.passwordHash.startsWith("$2b$") && user.passwordHash.length === 60}`);
      } else {
        console.log("   ⚠️  User has NO password hash - cannot login with credentials!");
      }
      console.log(`   Created At: ${user.createdAt}`);
    }

    // 3. Test Prisma Client
    console.log("\n5. Testing Prisma Client...");
    const userCount = await prisma.user.count();
    console.log(`✅ Prisma Client working - Found ${userCount} total users in database`);

  } catch (error) {
    console.error("\n❌ Error during diagnostic:");
    console.error(error);
    
    if (error instanceof Error) {
      console.error(`\nError message: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

diagnose()
  .then(() => {
    console.log("\n=== Diagnostic Complete ===");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

