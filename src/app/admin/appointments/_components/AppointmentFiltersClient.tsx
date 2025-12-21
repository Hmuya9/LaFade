"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, X } from "lucide-react";

interface Barber {
  id: string;
  name: string | null;
  email: string | null;
}

interface AppointmentFiltersClientProps {
  barbers: Barber[];
  searchParams: { status?: string; barberId?: string; dateFrom?: string; dateTo?: string };
}

export function AppointmentFiltersClient({ barbers, searchParams }: AppointmentFiltersClientProps) {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    
    const status = formData.get("status") as string;
    const barberId = formData.get("barberId") as string;
    const dateFrom = formData.get("dateFrom") as string;
    const dateTo = formData.get("dateTo") as string;
    
    if (status && status !== "ALL") params.set("status", status);
    if (barberId && barberId !== "ALL") params.set("barberId", barberId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    
    router.push(`/admin/appointments?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push("/admin/appointments");
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-slate-600" />
            <h3 className="font-semibold text-slate-900">Filters</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Status</label>
              <select
                name="status"
                defaultValue={searchParams.status || "ALL"}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              >
                <option value="ALL">All Statuses</option>
                <option value="BOOKED">Booked</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELED">Canceled</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Barber</label>
              <select
                name="barberId"
                defaultValue={searchParams.barberId || "ALL"}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              >
                <option value="ALL">All Barbers</option>
                {barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name || barber.email || "Unknown"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Date From</label>
              <Input
                type="date"
                name="dateFrom"
                defaultValue={searchParams.dateFrom || ""}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Date To</label>
              <Input
                type="date"
                name="dateTo"
                defaultValue={searchParams.dateTo || ""}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button type="submit" size="sm">
              Apply Filters
            </Button>
            <Button type="button" onClick={clearFilters} variant="outline" size="sm">
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

