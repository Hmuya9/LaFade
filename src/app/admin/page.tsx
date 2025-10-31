import { requireAdmin } from "@/lib/admin";
import { AdminMetrics } from "@/types"
import { MetricCard } from "@/components/MetricCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SkeletonList } from "@/components/ui/SkeletonList"
import { ErrorState } from "@/components/ui/ErrorState"
import Link from "next/link"

async function getAdminMetrics(): Promise<AdminMetrics> {
  const response = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/admin/metrics`, {
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error("Failed to fetch metrics");
  }
  const result = await response.json();
  return result.kpis;
}

export default async function AdminDashboard() {
  await requireAdmin();
  
  let data: AdminMetrics | null = null;
  let error: string | null = null;

  try {
    data = await getAdminMetrics();
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">Admin Dashboard</h1>
          </div>
          <ErrorState 
            title="Failed to load dashboard"
            description={error || "Unable to fetch metrics data"}
          />
        </div>
      </div>
    )
  }

  const formatCurrency = (cents: number) => 
    `$${(cents / 100).toFixed(2)}`

  const formatPercentage = (value: number) => 
    `${(value * 100).toFixed(1)}%`

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Admin Dashboard</h1>
          <p className="text-zinc-600">Business metrics and analytics</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <MetricCard
            title="Active Members"
            value={data.activeMembers}
            icon="👥"
          />
          <MetricCard
            title="Monthly Recurring Revenue"
            value={formatCurrency(data.mrr)}
            icon="💰"
          />
          <MetricCard
            title="Bookings This Week"
            value={data.bookingsThisWeek}
            icon="📅"
          />
          <MetricCard
            title="Completion Rate"
            value={formatPercentage(data.completionRate)}
            icon="✅"
          />
          <MetricCard
            title="Churn Rate (30d)"
            value={formatPercentage(data.churn30)}
            icon="📉"
            alert={data.churn30 > 0.05}
          />
          <MetricCard
            title="New Trials (7d)"
            value={data.trials7}
            icon="🆕"
          />
        </div>

        {/* Profit Panel */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-zinc-900">Profit Analysis (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
              <div className="text-center">
                <div className="text-sm text-zinc-600 mb-1">Revenue</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(data.revenue30)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-zinc-600 mb-1">Base Cost</div>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(data.breakdown.baseCost)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-zinc-600 mb-1">Standard Cost</div>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(data.breakdown.standardCost)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-zinc-600 mb-1">Deluxe Cost</div>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(data.breakdown.deluxeCost)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-zinc-600 mb-1">Bonus/Free</div>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(data.breakdown.bonusCost)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-zinc-600 mb-1">Operations</div>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(data.breakdown.opsCost)}
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm text-zinc-600 mb-2">Net Profit</div>
              <div className={`text-4xl font-bold ${
                data.profit >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {formatCurrency(data.profit)}
              </div>
              <div className="text-sm text-zinc-600 mt-2">
                Margin: {formatPercentage(data.revenue30 > 0 ? data.profit / data.revenue30 : 0)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-zinc-900">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/admin/barbers" className="block p-4 border-2 border-zinc-200 rounded-xl hover:border-zinc-300 transition-colors text-left">
                <div className="text-lg font-semibold mb-2 text-zinc-900">Manage Barbers</div>
                <div className="text-sm text-zinc-600">Add, edit, or remove barbers</div>
              </Link>
              <Link href="/admin/appointments" className="block p-4 border-2 border-zinc-200 rounded-xl hover:border-zinc-300 transition-colors text-left">
                <div className="text-lg font-semibold mb-2 text-zinc-900">View Appointments</div>
                <div className="text-sm text-zinc-600">See all upcoming bookings</div>
              </Link>
              <Link href="/admin/broadcast" className="block p-4 border-2 border-zinc-200 rounded-xl hover:border-zinc-300 transition-colors text-left">
                <div className="text-lg font-semibold mb-2 text-zinc-900">Send Notifications</div>
                <div className="text-sm text-zinc-600">Message all members</div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

