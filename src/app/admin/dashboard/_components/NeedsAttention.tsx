import { laf } from "@/components/ui/lafadeStyles";
import dayjs from "dayjs";

interface UnconfirmedBooking {
  appointmentId: string;
  clientName: string | null;
  clientEmail: string | null;
  barberName: string | null;
  startAt: string;
  hoursUnconfirmed: number;
  status: string;
}

interface TodayUnconfirmed {
  appointmentId: string;
  clientName: string | null;
  clientEmail: string | null;
  barberName: string | null;
  startAt: string;
  status: string;
}

interface StaleFreeCut {
  clientId: string;
  clientName: string | null;
  clientEmail: string | null;
  freeCutDate: string;
  daysSinceFreeCut: number;
  barberName: string | null;
}

interface NeedsAttentionResponse {
  unconfirmedBookings: UnconfirmedBooking[];
  todayUnconfirmed: TodayUnconfirmed[];
  staleFreeCuts: StaleFreeCut[];
}

async function fetchNeedsAttention(): Promise<NeedsAttentionResponse> {
  try {
    // Fetch from the existing endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    const response = await fetch(`${baseUrl}/api/admin/needs-attention`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      console.error('[NeedsAttention] Failed to fetch needs-attention:', response.status);
      return {
        unconfirmedBookings: [],
        todayUnconfirmed: [],
        staleFreeCuts: [],
      };
    }
    
    return await response.json();
  } catch (error) {
    console.error('[NeedsAttention] Error fetching needs-attention:', error);
    return {
      unconfirmedBookings: [],
      todayUnconfirmed: [],
      staleFreeCuts: [],
    };
  }
}

function formatTimeSince(hours: number): string {
  if (hours < 1) return "< 1 hour";
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatDaysSince(days: number): string {
  if (days === 1) return "1 day";
  return `${days} days`;
}

function getSeverityColor(value: number, type: 'booking' | 'stale'): string {
  if (type === 'booking') {
    // Red if >48h, amber if 24-48h
    if (value >= 48) return "bg-red-50 border-red-200";
    if (value >= 24) return "bg-amber-50 border-amber-200";
    return "bg-zinc-50 border-zinc-200";
  } else {
    // Red if >30 days, amber if 14-30 days
    if (value >= 30) return "bg-red-50 border-red-200";
    if (value >= 14) return "bg-amber-50 border-amber-200";
    return "bg-zinc-50 border-zinc-200";
  }
}

function getSeverityTextColor(value: number, type: 'booking' | 'stale'): string {
  if (type === 'booking') {
    if (value >= 48) return "text-red-700";
    if (value >= 24) return "text-amber-700";
    return "text-zinc-700";
  } else {
    if (value >= 30) return "text-red-700";
    if (value >= 14) return "text-amber-700";
    return "text-zinc-700";
  }
}

export default async function NeedsAttention() {
  const data = await fetchNeedsAttention();
  
  // Limit to max 10 rows per subsection
  const unconfirmedBookings = data.unconfirmedBookings.slice(0, 10);
  const todayUnconfirmed = data.todayUnconfirmed.slice(0, 10);
  const staleFreeCuts = data.staleFreeCuts.slice(0, 10);

  const totalCount = unconfirmedBookings.length + todayUnconfirmed.length + staleFreeCuts.length;

  return (
    <section className="mb-12">
      <h2 className={laf.h2 + " mb-4"}>
        {totalCount > 0 ? `🚨 Needs Attention (${totalCount})` : "Needs Attention"}
      </h2>
      <div className={`${laf.card} ${laf.cardPad}`}>
        <div className="space-y-4">
          {/* Unconfirmed Bookings (>24h) */}
          <details className="group">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900">
                    Unconfirmed Bookings (&gt;24h)
                  </span>
                  {unconfirmedBookings.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {unconfirmedBookings.length}
                    </span>
                  )}
                </div>
                <svg
                  className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </summary>
            <div className="mt-2 space-y-2">
              {unconfirmedBookings.length === 0 ? (
                <div className="py-4 px-3 text-sm text-zinc-500 text-center">
                  No unconfirmed bookings
                </div>
              ) : (
                unconfirmedBookings.map((booking) => (
                  <div
                    key={booking.appointmentId}
                    className={`p-3 rounded-lg border ${getSeverityColor(booking.hoursUnconfirmed, 'booking')}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-900 truncate">
                          {booking.clientName || booking.clientEmail || "Unknown"}
                        </div>
                        <div className="text-xs text-zinc-600 mt-1">
                          {booking.barberName || "Unknown barber"}
                        </div>
                      </div>
                      <div className={`text-xs font-medium ${getSeverityTextColor(booking.hoursUnconfirmed, 'booking')}`}>
                        {formatTimeSince(booking.hoursUnconfirmed)} ago
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </details>

          {/* Today Unconfirmed */}
          <details className="group">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900">
                    Today Unconfirmed
                  </span>
                  {todayUnconfirmed.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      {todayUnconfirmed.length}
                    </span>
                  )}
                </div>
                <svg
                  className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </summary>
            <div className="mt-2 space-y-2">
              {todayUnconfirmed.length === 0 ? (
                <div className="py-4 px-3 text-sm text-zinc-500 text-center">
                  No unconfirmed bookings today
                </div>
              ) : (
                todayUnconfirmed.map((booking) => {
                  const startTime = dayjs(booking.startAt);
                  const now = dayjs();
                  const hoursUntil = Math.max(0, startTime.diff(now, 'hour', true));
                  const isUrgent = hoursUntil < 4; // Urgent if less than 4 hours away
                  
                  return (
                    <div
                      key={booking.appointmentId}
                      className={`p-3 rounded-lg border ${
                        isUrgent 
                          ? "bg-red-50 border-red-200" 
                          : "bg-amber-50 border-amber-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-zinc-900 truncate">
                            {booking.clientName || booking.clientEmail || "Unknown"}
                          </div>
                          <div className="text-xs text-zinc-600 mt-1">
                            {booking.barberName || "Unknown barber"}
                          </div>
                          <div className="text-xs text-zinc-500 mt-1">
                            {startTime.format("h:mm A")}
                          </div>
                        </div>
                        <div className={`text-xs font-medium ${
                          isUrgent ? "text-red-700" : "text-amber-700"
                        }`}>
                          {hoursUntil < 1 
                            ? "Now" 
                            : hoursUntil < 24 
                            ? `in ${Math.floor(hoursUntil)}h`
                            : startTime.format("h:mm A")
                          }
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </details>

          {/* Stale Free Cuts */}
          <details className="group">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900">
                    Stale Free Cuts (&gt;14 days, no second cut)
                  </span>
                  {staleFreeCuts.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      {staleFreeCuts.length}
                    </span>
                  )}
                </div>
                <svg
                  className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </summary>
            <div className="mt-2 space-y-2">
              {staleFreeCuts.length === 0 ? (
                <div className="py-4 px-3 text-sm text-zinc-500 text-center">
                  No stale free cuts
                </div>
              ) : (
                staleFreeCuts.map((cut) => (
                  <div
                    key={cut.clientId}
                    className={`p-3 rounded-lg border ${getSeverityColor(cut.daysSinceFreeCut, 'stale')}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-900 truncate">
                          {cut.clientName || cut.clientEmail || "Unknown"}
                        </div>
                        <div className="text-xs text-zinc-600 mt-1">
                          {cut.barberName || "Unknown barber"}
                        </div>
                      </div>
                      <div className={`text-xs font-medium ${getSeverityTextColor(cut.daysSinceFreeCut, 'stale')}`}>
                        {formatDaysSince(cut.daysSinceFreeCut)} ago
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

