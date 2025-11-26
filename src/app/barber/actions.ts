"use server";

import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export type AvailabilitySlot = {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // "10:00"
  endTime: string;   // "14:00"
};

export type SaveAvailabilityResult = {
  success: boolean;
  error?: string;
};

/**
 * Auto-recovery: Create BarberAvailability table if it doesn't exist (P2021 error).
 * This helps self-heal when the database is missing the table.
 * Only runs in development mode.
 */
async function ensureBarberAvailabilityTable(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    return; // Skip auto-recovery in production
  }

  try {
    // Try to create the table if it doesn't exist
    // SQLite doesn't support CREATE TABLE IF NOT EXISTS in all contexts, so we use a transaction
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BarberAvailability" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "barberId" TEXT NOT NULL,
        "dayOfWeek" INTEGER NOT NULL,
        "startTime" TEXT NOT NULL,
        "endTime" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "BarberAvailability_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    // Create indexes if they don't exist (SQLite ignores IF NOT EXISTS on indexes, so we try/catch)
    try {
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "BarberAvailability_barberId_dayOfWeek_startTime_endTime_key" 
        ON "BarberAvailability"("barberId", "dayOfWeek", "startTime", "endTime");
      `);
    } catch (e: any) {
      // Index might already exist - ignore
      if (process.env.NODE_ENV === "development" && !e.message?.includes("already exists")) {
        console.warn("[barber][auto-recover] Index creation warning:", e.message);
      }
    }

    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "BarberAvailability_barberId_dayOfWeek_idx" 
        ON "BarberAvailability"("barberId", "dayOfWeek");
      `);
    } catch (e: any) {
      // Index might already exist - ignore
      if (process.env.NODE_ENV === "development" && !e.message?.includes("already exists")) {
        console.warn("[barber][auto-recover] Index creation warning:", e.message);
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[barber][auto-recover] Created BarberAvailability table on the fly after P2021. Retrying...");
    }
  } catch (error: any) {
    // If table creation fails, log but don't throw - let the original error surface
    console.error("[barber][auto-recover] Failed to create BarberAvailability table:", error.message);
    throw error; // Re-throw so original P2021 error is shown
  }
}

/**
 * Wrapper that handles P2021 errors by auto-creating the table.
 */
async function withBarberAvailabilityRecovery<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Check if this is a P2021 error (table does not exist) for BarberAvailability
    const isP2021Error = error?.code === "P2021" || error?.message?.includes("does not exist");
    const isBarberAvailabilityError =
      error?.message?.includes("BarberAvailability") ||
      error?.message?.includes("barberAvailability");

    if (isP2021Error && isBarberAvailabilityError && process.env.NODE_ENV === "development") {
      console.warn(`[barber][auto-recover] P2021 detected in ${operationName}, attempting auto-recovery...`);
      
      try {
        await ensureBarberAvailabilityTable();
        
        // Retry the operation once
        return await operation();
      } catch (recoveryError: any) {
        console.error(`[barber][auto-recover] Auto-recovery failed for ${operationName}:`, recoveryError);
        // Fall through to throw original error
      }
    }

    // Re-throw the original error if it's not a recoverable P2021
    throw error;
  }
}

/**
 * Save weekly availability for the logged-in barber.
 * Replaces all existing availability for this barber.
 * 
 * Note: Barbers and admins are created manually by setting user.role = 'BARBER' or 'OWNER'
 * in the database or via seed script. This action is only accessible to BARBER role.
 */
export async function saveBarberAvailability(
  slots: AvailabilitySlot[]
): Promise<SaveAvailabilityResult> {
  try {
    // Ensure user is logged in and has BARBER role
    const user = await requireRole(["BARBER", "OWNER"]);

    // Validate slots
    for (const slot of slots) {
      if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        return { success: false, error: "Invalid dayOfWeek (must be 0-6)" };
      }
      if (!slot.startTime || !slot.endTime) {
        return { success: false, error: "startTime and endTime are required" };
      }
      // Validate time format (HH:mm)
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
        return { success: false, error: "Time must be in HH:mm format (24-hour)" };
      }
      // Validate startTime < endTime
      const [startH, startM] = slot.startTime.split(":").map(Number);
      const [endH, endM] = slot.endTime.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      if (startMinutes >= endMinutes) {
        return { success: false, error: "startTime must be before endTime" };
      }
    }

    // Use transaction to replace all availability atomically
    if (process.env.NODE_ENV === "development") {
      console.log("[barber][saveAvailability] Saving availability:", {
        barberId: user.id,
        barberEmail: user.email,
        rangesCount: slots.length,
        ranges: slots.map(s => ({
          day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][s.dayOfWeek],
          time: `${s.startTime}-${s.endTime}`
        })),
        databaseUrl: process.env.DATABASE_URL?.substring(0, 50) + "..."
      });
    }

    await withBarberAvailabilityRecovery(async () => {
      return await prisma.$transaction(async (tx) => {
        // Delete all existing availability for this barber
        const deleted = await tx.barberAvailability.deleteMany({
          where: { barberId: user.id },
        });

        if (process.env.NODE_ENV === "development") {
          console.log("[barber][saveAvailability] Deleted existing ranges:", deleted.count);
        }

        // Create new availability entries
        if (slots.length > 0) {
          const created = await tx.barberAvailability.createMany({
            data: slots.map((slot) => ({
              barberId: user.id,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
            })),
          });
          
          if (process.env.NODE_ENV === "development") {
            console.log("[barber][saveAvailability] Created new ranges:", created.count);
          }
        }
      });
    }, "saveBarberAvailability");

    if (process.env.NODE_ENV === "development") {
      console.log("[barber][saveAvailability] Successfully saved availability");
    }

    return { success: true };
  } catch (error: any) {
    console.error("[barber][saveAvailability] Error:", error);
    
    // Handle redirect errors (from requireRole)
    if (error?.message?.includes("NEXT_REDIRECT")) {
      throw error;
    }

    return {
      success: false,
      error: error?.message || "Failed to save availability. Please try again.",
    };
  }
}

/**
 * Get weekly availability for the logged-in barber.
 */
export async function getBarberAvailability(): Promise<AvailabilitySlot[]> {
  try {
    const user = await requireRole(["BARBER", "OWNER"]);

    const availability = await withBarberAvailabilityRecovery(async () => {
      return await prisma.barberAvailability.findMany({
        where: { barberId: user.id },
        orderBy: [
          { dayOfWeek: "asc" },
          { startTime: "asc" },
        ],
      });
    }, "getBarberAvailability");

    if (process.env.NODE_ENV === "development") {
      console.log("[barber][getAvailability] Loaded availability:", {
        barberId: user.id,
        rangesCount: availability.length,
        ranges: availability.map(a => ({
          day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][a.dayOfWeek],
          time: `${a.startTime}-${a.endTime}`
        }))
      });
    }

    return availability.map((avail) => ({
      dayOfWeek: avail.dayOfWeek,
      startTime: avail.startTime,
      endTime: avail.endTime,
    }));
  } catch (error: any) {
    console.error("[barber][getAvailability] Error:", error);
    
    // Handle redirect errors
    if (error?.message?.includes("NEXT_REDIRECT")) {
      throw error;
    }
    
    // If P2021 error persists after recovery attempt, return empty array gracefully
    if (error?.code === "P2021" || error?.message?.includes("does not exist")) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[barber][getAvailability] Table still missing after recovery attempt, returning empty array");
      }
      return [];
    }
    
    return [];
  }
}

