import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

// Stripe price ID constants - must match Stripe dashboard EXACTLY
const STRIPE_PRICE_STANDARD = "price_1SaUJyBfxr2OXaLCg8Iukmaj";
const STRIPE_PRICE_DELUXE = "price_1SaUKWBfxr2OXaLC3CEn5nep";

// Plan pricing constants (in cents)
const STANDARD_PRICE_MONTHLY = 4500; // $45.00
const DELUXE_PRICE_MONTHLY = 9000; // $90.00

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

  // Create/update Standard Cut Membership plan
  // First, check if a plan with the correct Stripe price ID exists
  let standardPlan = await prisma.plan.findUnique({
    where: { stripePriceId: STRIPE_PRICE_STANDARD },
  });

  if (!standardPlan) {
    // Check if a plan named "Standard" exists with wrong Stripe price ID
    const existingStandard = await prisma.plan.findFirst({
      where: { 
        name: { in: ["Standard", "Standard Cut Membership"] },
        NOT: { stripePriceId: STRIPE_PRICE_STANDARD },
      },
    });

    if (existingStandard) {
      // Update existing plan with correct Stripe price ID
      standardPlan = await prisma.plan.update({
        where: { id: existingStandard.id },
        data: {
          name: "Standard",
          stripePriceId: STRIPE_PRICE_STANDARD,
          priceMonthly: STANDARD_PRICE_MONTHLY,
          cutsPerMonth: 2,
          isHome: false,
        },
      });
      console.log(`✅ Updated existing Standard plan with correct Stripe price ID`);
    } else {
      // Create new plan
      standardPlan = await prisma.plan.create({
        data: {
          name: "Standard",
          priceMonthly: STANDARD_PRICE_MONTHLY,
          cutsPerMonth: 2,
          isHome: false,
          stripePriceId: STRIPE_PRICE_STANDARD,
        },
      });
      console.log(`✅ Created new Standard plan`);
    }
  } else {
    // Update existing plan to ensure all fields are correct
    standardPlan = await prisma.plan.update({
      where: { id: standardPlan.id },
      data: {
        name: "Standard",
        priceMonthly: STANDARD_PRICE_MONTHLY,
        cutsPerMonth: 2,
        isHome: false,
      },
    });
    console.log(`✅ Updated Standard plan fields`);
  }

  console.log(`✅ Standard plan: ${standardPlan.name} (${standardPlan.id}) - Stripe: ${standardPlan.stripePriceId}`);

  // Create/update Deluxe Cut Membership plan
  // First, check if a plan with the correct Stripe price ID exists
  let deluxePlan = await prisma.plan.findUnique({
    where: { stripePriceId: STRIPE_PRICE_DELUXE },
  });

  if (!deluxePlan) {
    // Check if a plan named "Deluxe" exists with wrong Stripe price ID
    const existingDeluxe = await prisma.plan.findFirst({
      where: { 
        name: { in: ["Deluxe", "Deluxe Cut Membership"] },
        NOT: { stripePriceId: STRIPE_PRICE_DELUXE },
      },
    });

    if (existingDeluxe) {
      // Update existing plan with correct Stripe price ID
      deluxePlan = await prisma.plan.update({
        where: { id: existingDeluxe.id },
        data: {
          name: "Deluxe",
          stripePriceId: STRIPE_PRICE_DELUXE,
          priceMonthly: DELUXE_PRICE_MONTHLY,
          cutsPerMonth: 2,
          isHome: true,
        },
      });
      console.log(`✅ Updated existing Deluxe plan with correct Stripe price ID`);
    } else {
      // Create new plan
      deluxePlan = await prisma.plan.create({
        data: {
          name: "Deluxe",
          priceMonthly: DELUXE_PRICE_MONTHLY,
          cutsPerMonth: 2,
          isHome: true,
          stripePriceId: STRIPE_PRICE_DELUXE,
        },
      });
      console.log(`✅ Created new Deluxe plan`);
    }
  } else {
    // Update existing plan to ensure all fields are correct
    deluxePlan = await prisma.plan.update({
      where: { id: deluxePlan.id },
      data: {
        name: "Deluxe",
        priceMonthly: DELUXE_PRICE_MONTHLY,
        cutsPerMonth: 2,
        isHome: true,
      },
    });
    console.log(`✅ Updated Deluxe plan fields`);
  }

  console.log(`✅ Deluxe plan: ${deluxePlan.name} (${deluxePlan.id}) - Stripe: ${deluxePlan.stripePriceId}`);

  // Final verification: Query and log all plans
  const finalPlans = await prisma.plan.findMany({
    select: { id: true, name: true, stripePriceId: true, priceMonthly: true },
    orderBy: { name: "asc" },
  });

  console.log("\n✅ Seed completed successfully!");
  console.log("📝 All users have password: Password123!");
  console.log("📝 Plans synced with Stripe price IDs:");
  console.log(`   - Standard: ${standardPlan.stripePriceId} ($45.00/month)`);
  console.log(`   - Deluxe: ${deluxePlan.stripePriceId} ($90.00/month)`);
  console.log("\n📋 Final Plan Summary (for verification):");
  finalPlans.forEach((plan) => {
    console.log(`   - ${plan.name}: id=${plan.id}, stripePriceId=${plan.stripePriceId}, priceMonthly=${plan.priceMonthly} cents`);
  });
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
