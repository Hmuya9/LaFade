import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Development-only endpoint to check if BarberAvailability table is accessible.
 * This verifies that:
 * 1. The table exists in the database
 * 2. The Prisma client is up-to-date
 * 3. The connection is working
 * 
 * Access: http://localhost:3000/api/dev/check-db
 */
export async function GET() {
  try {
    const rows = await prisma.barberAvailability.findMany({
      take: 10, // Limit to first 10 rows
    });
    
    const count = await prisma.barberAvailability.count();
    
    return NextResponse.json({ 
      ok: true, 
      message: "BarberAvailability table is accessible",
      count,
      sampleRows: rows,
      tableExists: true
    });
  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: e.message,
      code: e.code,
      tableExists: false
    }, { status: 500 });
  }
}



