import { prisma } from "@/lib/db";
import { REAL_APPOINTMENT_WHERE } from "@/lib/analyticsFilters";
import { laf } from "@/components/ui/lafadeStyles";
import dayjs from "dayjs";

interface ClientHealthMetrics {
  repeatBookingRate: number;
  avgDaysBetweenCuts: number;
  percentOneTimeClients: number;
  percentRebookSameBarber: number;
}

async function getClientHealthMetrics(): Promise<ClientHealthMetrics> {
  // Get all appointments (non-canceled, exclude test users)
  const appointments = await prisma.appointment.findMany({
    where: {
      status: { not: "CANCELED" },
      ...REAL_APPOINTMENT_WHERE,
    },
    select: {
      clientId: true,
      barberId: true,
      startAt: true,
    },
    orderBy: {
      startAt: 'asc',
    },
  });

  // Group appointments by client
  const clientAppointments = new Map<string, Array<{ barberId: string; startAt: Date }>>();
  
  for (const apt of appointments) {
    if (!clientAppointments.has(apt.clientId)) {
      clientAppointments.set(apt.clientId, []);
    }
    clientAppointments.get(apt.clientId)!.push({
      barberId: apt.barberId,
      startAt: apt.startAt,
    });
  }

  const totalClients = clientAppointments.size;
  
  if (totalClients === 0) {
    return {
      repeatBookingRate: 0,
      avgDaysBetweenCuts: 0,
      percentOneTimeClients: 0,
      percentRebookSameBarber: 0,
    };
  }

  // Calculate metrics
  let repeatClients = 0;
  let oneTimeClients = 0;
  let clientsRebookingSameBarber = 0;
  const daysBetweenCuts: number[] = [];

  for (const [clientId, apts] of clientAppointments.entries()) {
    const appointmentCount = apts.length;
    
    // Repeat booking rate
    if (appointmentCount > 1) {
      repeatClients++;
      
      // Calculate days between cuts for this client
      for (let i = 1; i < apts.length; i++) {
        const daysDiff = dayjs(apts[i].startAt).diff(dayjs(apts[i - 1].startAt), 'day');
        daysBetweenCuts.push(daysDiff);
      }
      
      // Check if client rebooks with same barber
      const firstBarberId = apts[0].barberId;
      const allSameBarber = apts.every(apt => apt.barberId === firstBarberId);
      if (allSameBarber) {
        clientsRebookingSameBarber++;
      }
    } else {
      oneTimeClients++;
    }
  }

  // Calculate percentages
  const repeatBookingRate = totalClients > 0 ? (repeatClients / totalClients) * 100 : 0;
  const percentOneTimeClients = totalClients > 0 ? (oneTimeClients / totalClients) * 100 : 0;
  const percentRebookSameBarber = repeatClients > 0 
    ? (clientsRebookingSameBarber / repeatClients) * 100 
    : 0;
  
  // Calculate average days between cuts
  const avgDaysBetweenCuts = daysBetweenCuts.length > 0
    ? daysBetweenCuts.reduce((sum, days) => sum + days, 0) / daysBetweenCuts.length
    : 0;

  return {
    repeatBookingRate,
    avgDaysBetweenCuts,
    percentOneTimeClients,
    percentRebookSameBarber,
  };
}

export default async function ClientHealth() {
  const metrics = await getClientHealthMetrics();

  return (
    <section className="mb-12">
      <h2 className={laf.h2 + " mb-4"}>Client Health</h2>
      <div className={`${laf.card} ${laf.cardPad}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Repeat Booking Rate */}
          <div>
            <div className="text-sm text-zinc-600 mb-1">Repeat Booking Rate</div>
            <div className="text-2xl font-semibold text-zinc-900">
              {metrics.repeatBookingRate.toFixed(1)}%
            </div>
          </div>

          {/* Avg Days Between Cuts */}
          <div>
            <div className="text-sm text-zinc-600 mb-1">Avg Days Between Cuts</div>
            <div className="text-2xl font-semibold text-zinc-900">
              {metrics.avgDaysBetweenCuts.toFixed(1)}
            </div>
          </div>

          {/* % Clients Who Only Booked Once */}
          <div>
            <div className="text-sm text-zinc-600 mb-1">% Clients Who Only Booked Once</div>
            <div className="text-2xl font-semibold text-zinc-900">
              {metrics.percentOneTimeClients.toFixed(1)}%
            </div>
          </div>

          {/* % Clients Who Rebook With Same Barber */}
          <div>
            <div className="text-sm text-zinc-600 mb-1">% Rebook With Same Barber</div>
            <div className="text-2xl font-semibold text-zinc-900">
              {metrics.percentRebookSameBarber.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

