import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export default async function AdminAppointments() {
  await requireAdmin();
  
  const now = new Date();
  const appts = await prisma.appointment.findMany({
    where: { startAt: { gte: now } },
    orderBy: { startAt: "asc" },
    select: { 
      id: true, 
      startAt: true, 
      endAt: true, 
      notes: true,
      client: { select: { name: true, email: true } },
      barber: { select: { name: true, email: true } },
    }
  });

  return (
    <div className="max-w-5xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Upcoming Appointments</h1>
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">When</th>
              <th className="p-3 text-left">Client</th>
              <th className="p-3 text-left">Barber</th>
              <th className="p-3 text-left">Notes</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {appts.map(a => (
              <tr key={a.id} className="border-t">
                <td className="p-3">{a.startAt.toLocaleString()}</td>
                <td className="p-3">{a.client?.name || a.client?.email}</td>
                <td className="p-3">{a.barber?.name || a.barber?.email}</td>
                <td className="p-3">{a.notes || "-"}</td>
                <td className="p-3 text-right">
                  <form method="post" action={`/api/admin/appointments/${a.id}/cancel`}>
                    <button className="rounded-md border px-3 py-1 hover:bg-gray-50">Cancel</button>
                  </form>
                </td>
              </tr>
            ))}
            {appts.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-500">No upcoming appointments</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
