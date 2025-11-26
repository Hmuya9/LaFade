import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.BARBER_EMAIL || "").toLowerCase();
  if (!email) throw new Error("BARBER_EMAIL not set");
  
  console.log(`🔍 Looking for user with email: ${email}`);
  
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true }
  });
  
  if (!user) {
    console.log(`❌ User not found with email: ${email}`);
    return;
  }
  
  console.log(`📋 Current user:`, user);
  
  if (user.role === "BARBER") {
    console.log(`✅ User ${email} is already BARBER`);
    return;
  }
  
  await prisma.user.update({
    where: { email },
    data: { role: "BARBER" },
  });
  
  console.log(`✅ Promoted ${email} to BARBER`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });






