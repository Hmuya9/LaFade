import { PrismaClient } from "@prisma/client";

// Development database (from .env.local)
const devDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DEV_DATABASE_URL || "postgresql://neondb_owner:npg_IM3U6wEDZAVR@ep-restless-dream-af1x4q7x-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    },
  },
});

// Production database
const prodDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_IM3U6wEDZAVR@ep-little-tree-afqheu9o.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    },
  },
});

async function copyData() {
  console.log("🚀 Starting data copy from dev to production...\n");

  try {
    // Step 1: Copy independent tables (no foreign keys)
    console.log("📋 Step 1: Copying independent tables...");
    
    // Plans
    const plans = await devDb.plan.findMany();
    if (plans.length > 0) {
      console.log(`  Copying ${plans.length} plans...`);
      for (const plan of plans) {
        await prodDb.plan.upsert({
          where: { id: plan.id },
          update: plan,
          create: plan,
        });
      }
      console.log(`  ✅ Copied ${plans.length} plans`);
    }

    // MembershipPlan
    const membershipPlans = await devDb.membershipPlan.findMany();
    if (membershipPlans.length > 0) {
      console.log(`  Copying ${membershipPlans.length} membership plans...`);
      for (const plan of membershipPlans) {
        await prodDb.membershipPlan.upsert({
          where: { id: plan.id },
          update: plan,
          create: plan,
        });
      }
      console.log(`  ✅ Copied ${membershipPlans.length} membership plans`);
    }

    // PromoCode
    const promoCodes = await devDb.promoCode.findMany();
    if (promoCodes.length > 0) {
      console.log(`  Copying ${promoCodes.length} promo codes...`);
      for (const promo of promoCodes) {
        await prodDb.promoCode.upsert({
          where: { id: promo.id },
          update: promo,
          create: promo,
        });
      }
      console.log(`  ✅ Copied ${promoCodes.length} promo codes`);
    }

    // Review
    const reviews = await devDb.review.findMany();
    if (reviews.length > 0) {
      console.log(`  Copying ${reviews.length} reviews...`);
      for (const review of reviews) {
        await prodDb.review.upsert({
          where: { id: review.id },
          update: review,
          create: review,
        });
      }
      console.log(`  ✅ Copied ${reviews.length} reviews`);
    }

    // EventLog
    const eventLogs = await devDb.eventLog.findMany();
    if (eventLogs.length > 0) {
      console.log(`  Copying ${eventLogs.length} event logs...`);
      for (const log of eventLogs) {
        await prodDb.eventLog.upsert({
          where: { id: log.id },
          update: log,
          create: log,
        });
      }
      console.log(`  ✅ Copied ${eventLogs.length} event logs`);
    }

    // Availability (legacy) - uses autoincrement ID, so use createMany with skipDuplicates
    const availabilities = await devDb.availability.findMany();
    if (availabilities.length > 0) {
      console.log(`  Copying ${availabilities.length} availability records...`);
      try {
        await prodDb.availability.createMany({
          data: availabilities.map(avail => ({
            barberName: avail.barberName,
            date: avail.date,
            timeSlot: avail.timeSlot,
            isBooked: avail.isBooked,
            createdAt: avail.createdAt,
          })),
          skipDuplicates: true,
        });
        console.log(`  ✅ Copied availability records`);
      } catch (error: any) {
        console.log(`  ⚠️  Some availability records may already exist, continuing...`);
      }
    }

    // VerificationToken - no ID field, use createMany
    const verificationTokens = await devDb.verificationToken.findMany();
    if (verificationTokens.length > 0) {
      console.log(`  Copying ${verificationTokens.length} verification tokens...`);
      try {
        await prodDb.verificationToken.createMany({
          data: verificationTokens,
          skipDuplicates: true,
        });
        console.log(`  ✅ Copied verification tokens`);
      } catch (error: any) {
        console.log(`  ⚠️  Some verification tokens may already exist, continuing...`);
      }
    }

    // Step 2: Copy Users (required for most other tables)
    console.log("\n👥 Step 2: Copying users...");
    const users = await devDb.user.findMany();
    if (users.length > 0) {
      console.log(`  Copying ${users.length} users...`);
      let copied = 0;
      let updated = 0;
      let skipped = 0;
      for (const user of users) {
        try {
          // Try to find by email first, then by id
          const existingUser = user.email 
            ? await prodDb.user.findUnique({ where: { email: user.email } })
            : null;
          
          if (existingUser) {
            // Update existing user
            await prodDb.user.update({
              where: { id: existingUser.id },
              data: {
                role: user.role,
                email: user.email,
                emailVerified: user.emailVerified,
                phone: user.phone,
                name: user.name,
                image: user.image,
                clerkId: user.clerkId,
                passwordHash: user.passwordHash,
                city: user.city,
                hasAnsweredFreeCutQuestion: user.hasAnsweredFreeCutQuestion,
              },
            });
            updated++;
          } else {
            // Try to create new user
            try {
              await prodDb.user.create({ data: user });
              copied++;
            } catch (createError: any) {
              // If email conflict, try to update by ID
              if (createError.code === 'P2002' && createError.meta?.target?.includes('email')) {
                const existingById = await prodDb.user.findUnique({ where: { id: user.id } });
                if (existingById) {
                  await prodDb.user.update({
                    where: { id: user.id },
                    data: {
                      role: user.role,
                      email: user.email,
                      emailVerified: user.emailVerified,
                      phone: user.phone,
                      name: user.name,
                      image: user.image,
                      clerkId: user.clerkId,
                      passwordHash: user.passwordHash,
                      city: user.city,
                      hasAnsweredFreeCutQuestion: user.hasAnsweredFreeCutQuestion,
                    },
                  });
                  updated++;
                } else {
                  skipped++;
                  console.log(`    ⚠️  Skipped user ${user.email || user.id} due to email conflict`);
                }
              } else {
                throw createError;
              }
            }
          }
        } catch (error: any) {
          if (error.code === 'P2002') {
            skipped++;
            console.log(`    ⚠️  Skipped user ${user.email || user.id} due to unique constraint`);
          } else {
            throw error;
          }
        }
      }
      console.log(`  ✅ Copied ${copied} users, updated ${updated} users, skipped ${skipped} users`);
    }

    // Step 3: Copy tables that depend on Users
    console.log("\n📊 Step 3: Copying user-dependent tables...");

    // Subscriptions
    const subscriptions = await devDb.subscription.findMany();
    if (subscriptions.length > 0) {
      console.log(`  Copying ${subscriptions.length} subscriptions...`);
      for (const sub of subscriptions) {
        await prodDb.subscription.upsert({
          where: { id: sub.id },
          update: sub,
          create: sub,
        });
      }
      console.log(`  ✅ Copied ${subscriptions.length} subscriptions`);
    }

    // MembershipSubscription
    const membershipSubs = await devDb.membershipSubscription.findMany();
    if (membershipSubs.length > 0) {
      console.log(`  Copying ${membershipSubs.length} membership subscriptions...`);
      for (const sub of membershipSubs) {
        await prodDb.membershipSubscription.upsert({
          where: { id: sub.id },
          update: sub,
          create: sub,
        });
      }
      console.log(`  ✅ Copied ${membershipSubs.length} membership subscriptions`);
    }

    // BarberAvailability
    const barberAvails = await devDb.barberAvailability.findMany();
    if (barberAvails.length > 0) {
      console.log(`  Copying ${barberAvails.length} barber availability records...`);
      for (const avail of barberAvails) {
        try {
          await prodDb.barberAvailability.upsert({
            where: {
              barberId_dayOfWeek_startTime_endTime: {
                barberId: avail.barberId,
                dayOfWeek: avail.dayOfWeek,
                startTime: avail.startTime,
                endTime: avail.endTime,
              },
            },
            update: {
              createdAt: avail.createdAt,
              updatedAt: avail.updatedAt,
            },
            create: avail,
          });
        } catch (error: any) {
          if (!error.message?.includes("Unique constraint")) {
            throw error;
          }
        }
      }
      console.log(`  ✅ Copied ${barberAvails.length} barber availability records`);
    }

    // Accounts
    const accounts = await devDb.account.findMany();
    if (accounts.length > 0) {
      console.log(`  Copying ${accounts.length} accounts...`);
      for (const account of accounts) {
        await prodDb.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          update: account,
          create: account,
        });
      }
      console.log(`  ✅ Copied ${accounts.length} accounts`);
    }

    // Sessions
    const sessions = await devDb.session.findMany();
    if (sessions.length > 0) {
      console.log(`  Copying ${sessions.length} sessions...`);
      for (const session of sessions) {
        await prodDb.session.upsert({
          where: { id: session.id },
          update: session,
          create: session,
        });
      }
      console.log(`  ✅ Copied ${sessions.length} sessions`);
    }

    // PasswordResetTokens
    const passwordResetTokens = await devDb.passwordResetToken.findMany();
    if (passwordResetTokens.length > 0) {
      console.log(`  Copying ${passwordResetTokens.length} password reset tokens...`);
      for (const token of passwordResetTokens) {
        await prodDb.passwordResetToken.upsert({
          where: { id: token.id },
          update: token,
          create: token,
        });
      }
      console.log(`  ✅ Copied ${passwordResetTokens.length} password reset tokens`);
    }

    // Photos
    const photos = await devDb.photo.findMany();
    if (photos.length > 0) {
      console.log(`  Copying ${photos.length} photos...`);
      for (const photo of photos) {
        await prodDb.photo.upsert({
          where: { id: photo.id },
          update: photo,
          create: photo,
        });
      }
      console.log(`  ✅ Copied ${photos.length} photos`);
    }

    // PointsLedger
    const pointsLedger = await devDb.pointsLedger.findMany();
    if (pointsLedger.length > 0) {
      console.log(`  Copying ${pointsLedger.length} points ledger entries...`);
      for (const entry of pointsLedger) {
        await prodDb.pointsLedger.upsert({
          where: { id: entry.id },
          update: entry,
          create: entry,
        });
      }
      console.log(`  ✅ Copied ${pointsLedger.length} points ledger entries`);
    }

    // CashAppPaymentIntent
    const cashAppIntents = await devDb.cashAppPaymentIntent.findMany();
    if (cashAppIntents.length > 0) {
      console.log(`  Copying ${cashAppIntents.length} Cash App payment intents...`);
      for (const intent of cashAppIntents) {
        await prodDb.cashAppPaymentIntent.upsert({
          where: { id: intent.id },
          update: intent,
          create: intent,
        });
      }
      console.log(`  ✅ Copied ${cashAppIntents.length} Cash App payment intents`);
    }

    // Step 4: Copy Appointments (depends on Users)
    console.log("\n📅 Step 4: Copying appointments...");
    const appointments = await devDb.appointment.findMany();
    if (appointments.length > 0) {
      console.log(`  Copying ${appointments.length} appointments...`);
      for (const apt of appointments) {
        try {
          await prodDb.appointment.upsert({
            where: { id: apt.id },
            update: apt,
            create: apt,
          });
        } catch (error: any) {
          // Handle unique constraint violations on barberId/startAt or clientId/startAt
          if (error.message?.includes("Unique constraint")) {
            console.log(`    ⚠️  Skipping duplicate appointment: ${apt.id}`);
            continue;
          }
          throw error;
        }
      }
      console.log(`  ✅ Copied appointments`);
    }

    // Step 5: Copy Payouts (depends on Users)
    console.log("\n💰 Step 5: Copying payouts...");
    const payouts = await devDb.payout.findMany();
    if (payouts.length > 0) {
      console.log(`  Copying ${payouts.length} payouts...`);
      for (const payout of payouts) {
        await prodDb.payout.upsert({
          where: { id: payout.id },
          update: payout,
          create: payout,
        });
      }
      console.log(`  ✅ Copied ${payouts.length} payouts`);
    }

    // Step 6: Copy Payments (depends on Users)
    console.log("\n💳 Step 6: Copying payments...");
    const payments = await devDb.payment.findMany();
    if (payments.length > 0) {
      console.log(`  Copying ${payments.length} payments...`);
      for (const payment of payments) {
        await prodDb.payment.upsert({
          where: { id: payment.id },
          update: payment,
          create: payment,
        });
      }
      console.log(`  ✅ Copied ${payments.length} payments`);
    }

    console.log("\n✅ Data copy completed successfully!");
    
    // Summary
    console.log("\n📊 Summary:");
    const prodUsers = await prodDb.user.count();
    const prodAppts = await prodDb.appointment.count();
    const prodSubs = await prodDb.subscription.count();
    console.log(`  Users in production: ${prodUsers}`);
    console.log(`  Appointments in production: ${prodAppts}`);
    console.log(`  Subscriptions in production: ${prodSubs}`);

  } catch (error) {
    console.error("❌ Error copying data:", error);
    throw error;
  } finally {
    await devDb.$disconnect();
    await prodDb.$disconnect();
  }
}

copyData()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

