import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const password = "Password123!";
  const passwordHash = await bcrypt.hash(password, 10);

  // Create/update ADMIN user (using OWNER role from schema)
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      role: "OWNER",
      name: "Admin User",
      passwordHash,
    },
    create: {
      email: "admin@example.com",
      name: "Admin User",
      role: "OWNER",
      passwordHash,
    },
  });

  console.log(`✅ Created/updated admin user: ${admin.email} (${admin.id})`);

  // Create/update first barber
  const barber1 = await prisma.user.upsert({
    where: { email: "barber1@example.com" },
    update: {
      role: "BARBER",
      name: "Barber One",
      passwordHash,
    },
    create: {
      email: "barber1@example.com",
      name: "Barber One",
      role: "BARBER",
      passwordHash,
    },
  });

  console.log(`✅ Created/updated barber 1: ${barber1.email} (${barber1.id})`);

  // Create/update second barber
  const barber2 = await prisma.user.upsert({
    where: { email: "barber2@example.com" },
    update: {
      role: "BARBER",
      name: "Barber Two",
      passwordHash,
    },
    create: {
      email: "barber2@example.com",
      name: "Barber Two",
      role: "BARBER",
      passwordHash,
    },
  });

  console.log(`✅ Created/updated barber 2: ${barber2.email} (${barber2.id})`);

  console.log("\n✅ Seed completed successfully!");
  console.log("📝 All users have password: Password123!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
