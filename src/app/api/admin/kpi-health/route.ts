import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { computeKPIHealth } from "@/lib/kpiHealth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();

    const health = await computeKPIHealth();

    return NextResponse.json(health);
  } catch (error) {
    console.error("[api/admin/kpi-health] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to compute KPI health",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

