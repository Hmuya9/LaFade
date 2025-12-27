import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendAdminEmail } from "@/lib/email";
import { computeKPIHealth } from "@/lib/kpiHealth";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron route for daily KPI health alerts.
 * 
 * Schedule: "0 17 * * *" (17:00 UTC = 9:00 AM America/Los_Angeles)
 * Runs daily at 9:00 AM Pacific Time.
 * 
 * Security: Requires Authorization header with CRON_SECRET
 */
export async function GET(request: Request) {
  try {
    // Security: Check CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.CRON_SECRET;
    
    if (!expectedSecret) {
      console.error("[cron/kpi-alert] CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Cron secret not configured" },
        { status: 500 }
      );
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const providedSecret = authHeader.substring(7); // Remove "Bearer "
    if (providedSecret !== expectedSecret) {
      return NextResponse.json(
        { error: "Invalid authorization token" },
        { status: 401 }
      );
    }

    // Get today's date in LA timezone (YYYY-MM-DD)
    const todayLA = dayjs().tz("America/Los_Angeles").format("YYYY-MM-DD");
    const alertKey = "kpi-health";

    // Check idempotency: has alert already been sent today?
    // Runtime guard: If AlertLog table doesn't exist, this will throw
    let existingLog;
    try {
      existingLog = await prisma.alertLog.findUnique({
        where: {
          key_date: {
            key: alertKey,
            date: todayLA,
          },
        },
      });
    } catch (error: any) {
      // If table doesn't exist, Prisma will throw an error
      const errorMessage = error?.message || String(error);
      const errorCode = (error as any)?.code;
      
      // Check for table doesn't exist errors
      if (
        errorMessage.includes("does not exist") ||
        errorMessage.includes("AlertLog") ||
        errorMessage.includes("relation") ||
        errorCode === "P2021" // Table does not exist
      ) {
        console.error("[cron/kpi-alert] AlertLog table not found - migration not run", { error: errorMessage });
        return NextResponse.json(
          {
            error: "AlertLog not migrated. Run prisma migrate deploy.",
            message: "The AlertLog table does not exist. Please run the database migration.",
          },
          { status: 500 }
        );
      }
      
      // Check for authentication/connection errors
      if (
        errorMessage.includes("Authentication failed") ||
        errorMessage.includes("P1001") || // Can't reach database server
        errorMessage.includes("P1000") || // Authentication failed
        errorCode === "P1001" ||
        errorCode === "P1000"
      ) {
        console.error("[cron/kpi-alert] Database connection/authentication error", { 
          error: errorMessage, 
          errorCode,
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          databaseUrlPreview: process.env.DATABASE_URL ? 
            process.env.DATABASE_URL.substring(0, 50) + "..." : 
            "not set"
        });
        return NextResponse.json(
          {
            error: "Database connection failed",
            message: `Database authentication or connection error. Check DATABASE_URL in .env.local matches the database where migration was run. Error: ${errorMessage}`,
          },
          { status: 500 }
        );
      }
      
      // Log and re-throw other errors
      console.error("[cron/kpi-alert] Unexpected error checking AlertLog", { error: errorMessage, errorCode });
      throw error;
    }

    if (existingLog) {
      console.log("[cron/kpi-alert] Alert already sent today", { date: todayLA });
      return NextResponse.json({
        sent: false,
        reason: "already_sent",
        date: todayLA,
      });
    }

    // Compute KPI health
    const health = await computeKPIHealth();

    // If ok=true, no email needed
    if (health.ok) {
      console.log("[cron/kpi-alert] KPI health OK, no alert needed", { date: todayLA });
      
      // Still log that we checked (optional, but useful for audit)
      await prisma.alertLog.create({
        data: {
          key: alertKey,
          date: todayLA,
          payloadJson: { ok: true, checked: true },
        },
      });

      return NextResponse.json({
        sent: false,
        reason: "ok",
        date: todayLA,
      });
    }

    // Build email body
    const subject = `🚨 LaFade KPI Alert — ${todayLA}`;
    const lines: string[] = [];

    lines.push(`Window: ${dayjs(health.window.startAtISO).format("YYYY-MM-DD HH:mm")} to ${dayjs(health.window.endAtISO).format("YYYY-MM-DD HH:mm")}`);
    lines.push("");
    lines.push("KPI Metrics:");
    lines.push(`  Free Cuts (7d): ${health.krs.freeCuts7d}`);
    lines.push(`  Second Cuts (7d): ${health.krs.secondCuts7d}`);
    lines.push(`  New Members (7d): ${health.krs.newMembers7d}`);
    lines.push(`  Free → Member % (7d): ${health.krs.freeToMember7d.toFixed(1)}%`);
    lines.push(`  Needs Attention: ${health.krs.needsAttentionNow}`);
    lines.push("");
    lines.push("Breaches:");
    
    for (const breach of health.breaches) {
      lines.push(`  [${breach.severity}] ${breach.key}: ${breach.message}`);
      lines.push(`    Current: ${breach.current}, Threshold: ${breach.threshold}`);
    }

    lines.push("");
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : "http://localhost:3000";
    lines.push(`View dashboard: ${baseUrl}/admin/dashboard`);

    const emailText = lines.join("\n");

    // Send email
    const emailResult = await sendAdminEmail({
      subject,
      text: emailText,
    });

    if (!emailResult.emailed) {
      console.error("[cron/kpi-alert] Failed to send email", { 
        reason: emailResult.reason,
        date: todayLA 
      });
      
      // Log the failure attempt
      await prisma.alertLog.create({
        data: {
          key: alertKey,
          date: todayLA,
          payloadJson: { 
            ok: false, 
            breaches: health.breaches,
            emailSent: false,
            emailError: emailResult.reason,
          },
        },
      });

      return NextResponse.json({
        sent: false,
        reason: emailResult.reason || "email_failed",
        date: todayLA,
      });
    }

    // Log successful send
    await prisma.alertLog.create({
      data: {
        key: alertKey,
        date: todayLA,
        payloadJson: {
          ok: false,
          breaches: health.breaches,
          krs: health.krs,
          emailSent: true,
        },
      },
    });

    console.log("[cron/kpi-alert] Alert sent successfully", { date: todayLA, breaches: health.breaches.length });

    return NextResponse.json({
      sent: true,
      date: todayLA,
      breaches: health.breaches.length,
    });
  } catch (error) {
    console.error("[cron/kpi-alert] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to process KPI alert",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

