/**
 * Remove duplicate appointments by (barberId, startAt) and (clientId, startAt)
 * Keeps the appointment with the earliest ID (oldest record)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeDuplicates() {
  try {
    console.log('🧹 Starting duplicate appointment cleanup...');

    // Get counts before cleanup
    const totalAppointments = await prisma.appointment.count();
    console.log(`📊 Total appointments before cleanup: ${totalAppointments}`);

    // Find duplicates by barber + time
    const barberDuplicates = await prisma.$queryRaw<Array<{barberId: string, startAt: number, count: number}>>`
      SELECT barberId, startAt, COUNT(*) as count
      FROM Appointment
      GROUP BY barberId, startAt
      HAVING COUNT(*) > 1
    `;

    console.log(`🔍 Found ${barberDuplicates.length} groups with barber+time duplicates`);

    // Find duplicates by client + time
    const clientDuplicates = await prisma.$queryRaw<Array<{clientId: string, startAt: number, count: number}>>`
      SELECT clientId, startAt, COUNT(*) as count
      FROM Appointment
      GROUP BY clientId, startAt
      HAVING COUNT(*) > 1
    `;

    console.log(`🔍 Found ${clientDuplicates.length} groups with client+time duplicates`);

    // Remove barber duplicates (keep earliest by ID)
    let barberRemoved = 0;
    for (const group of barberDuplicates) {
      const startAt = new Date(group.startAt);
      
      const duplicates = await prisma.appointment.findMany({
        where: {
          barberId: group.barberId,
          startAt,
        },
        orderBy: { id: 'asc' }, // Keep the first (earliest) one
        select: { id: true },
      });

      // Delete all except the first one
      const toDelete = duplicates.slice(1);
      for (const appointment of toDelete) {
        await prisma.appointment.delete({
          where: { id: appointment.id },
        });
        barberRemoved++;
      }
    }

    // Remove client duplicates (keep earliest by ID)
    let clientRemoved = 0;
    for (const group of clientDuplicates) {
      const startAt = new Date(group.startAt);
      
      const duplicates = await prisma.appointment.findMany({
        where: {
          clientId: group.clientId,
          startAt,
        },
        orderBy: { id: 'asc' }, // Keep the first (earliest) one
        select: { id: true },
      });

      // Delete all except the first one
      const toDelete = duplicates.slice(1);
      for (const appointment of toDelete) {
        await prisma.appointment.delete({
          where: { id: appointment.id },
        });
        clientRemoved++;
      }
    }

    const totalRemoved = barberRemoved + clientRemoved;
    const totalAfter = await prisma.appointment.count();

    console.log('✅ Cleanup completed!');
    console.log(`📈 Removed ${barberRemoved} barber+time duplicates`);
    console.log(`📈 Removed ${clientRemoved} client+time duplicates`);
    console.log(`📊 Total removed: ${totalRemoved}`);
    console.log(`📊 Total appointments after cleanup: ${totalAfter}`);

    if (totalRemoved === 0) {
      console.log('🎉 No duplicates found - database is clean!');
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
removeDuplicates()
  .then(() => {
    console.log('🏁 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });