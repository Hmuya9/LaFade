import { laf } from "@/components/ui/lafadeStyles";

interface BarberConversion {
  barberId: string;
  barberName: string | null;
  barberEmail: string | null;
  freeCutsGiven: number;
  secondCutsConverted: number;
  membersConverted: number;
  freeToSecondPercent: number;
  freeToMemberPercent: number;
}

interface BarberConversionResponse {
  barbers: BarberConversion[];
}

async function fetchBarberConversion(): Promise<BarberConversionResponse> {
  try {
    // Fetch from the existing endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    const response = await fetch(`${baseUrl}/api/admin/barber-conversion`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      console.error('[BarberPerformance] Failed to fetch barber-conversion:', response.status);
      return { barbers: [] };
    }
    
    return await response.json();
  } catch (error) {
    console.error('[BarberPerformance] Error fetching barber-conversion:', error);
    return { barbers: [] };
  }
}

export default async function BarberPerformance() {
  const data = await fetchBarberConversion();
  
  // Data is already sorted by Free → Member % DESC from the API
  const barbers = data.barbers;
  
  // Calculate bottom 20% - get the last 20% of barbers (lowest performers)
  const bottom20PercentCount = Math.ceil(barbers.length * 0.2);
  const bottom20PercentStartIndex = Math.max(0, barbers.length - bottom20PercentCount);
  const bottom20PercentIds = new Set(
    barbers.slice(bottom20PercentStartIndex).map(b => b.barberId)
  );
  
  // Top performer is the first barber (highest Free → Member %)
  const topPerformerId = barbers.length > 0 ? barbers[0].barberId : null;

  return (
    <section className="mb-12">
      <h2 className={laf.h2 + " mb-4"}>Barber Performance</h2>
      <div className={`${laf.card} ${laf.cardPad} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-900">Barber</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-zinc-900">Free Cuts Given</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-zinc-900">Free → Second %</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-zinc-900">Free → Member %</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-zinc-900">Members Converted</th>
            </tr>
          </thead>
          <tbody>
            {barbers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 px-4 text-center text-sm text-zinc-500">
                  No barber data available
                </td>
              </tr>
            ) : (
              barbers.map((barber) => {
                const isTopPerformer = barber.barberId === topPerformerId;
                const isBottom20Percent = bottom20PercentIds.has(barber.barberId);
                
                // Determine row styling
                let rowClassName = "border-b border-zinc-100 hover:bg-zinc-50";
                if (isTopPerformer) {
                  rowClassName = "border-b border-zinc-100 bg-green-50 hover:bg-green-100";
                } else if (isBottom20Percent) {
                  rowClassName = "border-b border-zinc-100 bg-red-50 hover:bg-red-100";
                }

                return (
                  <tr key={barber.barberId} className={rowClassName}>
                    <td className="py-3 px-4 text-sm text-zinc-900">
                      <div className="font-medium">{barber.barberName || "Unknown"}</div>
                      <div className="text-xs text-zinc-500">{barber.barberEmail || ""}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-700 text-right">
                      {barber.freeCutsGiven.toLocaleString()}
                    </td>
                    <td className={`py-3 px-4 text-sm text-right ${
                      isTopPerformer ? "text-green-700 font-semibold" : 
                      isBottom20Percent ? "text-red-700" : 
                      "text-zinc-700"
                    }`}>
                      {barber.freeToSecondPercent.toFixed(1)}%
                    </td>
                    <td className={`py-3 px-4 text-sm font-semibold text-right ${
                      isTopPerformer ? "text-green-700" : 
                      isBottom20Percent ? "text-red-700" : 
                      "text-zinc-900"
                    }`}>
                      {barber.freeToMemberPercent.toFixed(1)}%
                    </td>
                    <td className={`py-3 px-4 text-sm text-right ${
                      isTopPerformer ? "text-green-700 font-semibold" : 
                      isBottom20Percent ? "text-red-700" : 
                      "text-zinc-700"
                    }`}>
                      {barber.membersConverted.toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

