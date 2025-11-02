import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export default async function AdminBarbers() {
  await requireAdmin();
  
  const barbers = await prisma.user.findMany({ 
    where: { role: "BARBER" }, 
    select: { id: true, name: true, email: true, createdAt: true } 
  });

  return (
    <div className="max-w-4xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Manage Barbers</h1>
      <div className="space-y-3">
        {barbers.map(b => (
          <div key={b.id} className="rounded-lg border p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{b.name || "Unnamed"}</div>
              <div className="text-sm text-gray-500">{b.email}</div>
            </div>
            {/* Example action: clear all future availability for this barber */}
            <form action={`/api/admin/barbers/${b.id}/clear-availability`} method="post">
              <button className="rounded-md border px-3 py-1 hover:bg-gray-50" type="submit">
                Clear Future Availability
              </button>
            </form>
          </div>
        ))}
        {barbers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No barbers found
          </div>
        )}
      </div>
    </div>
  );
}

