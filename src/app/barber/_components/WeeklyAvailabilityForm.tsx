"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { saveBarberAvailability, getBarberAvailability, type AvailabilitySlot } from "../actions";
import { Plus, Trash2, Clock, Calendar, Loader2, CheckCircle2 } from "lucide-react";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

/**
 * Get current week label (e.g., "Week of Nov 24 – Nov 30")
 * Shows which week the recurring pattern applies to.
 */
function getCurrentWeekLabel(): string {
  const today = new Date();

  // Start of week (Sunday = 0)
  const day = today.getDay(); // 0–6 (0 = Sunday)
  const start = new Date(today);
  start.setDate(today.getDate() - day); // week start (Sunday)

  const end = new Date(start);
  end.setDate(start.getDate() + 6); // week end (Saturday)

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  return `Week of ${formatter.format(start)} – ${formatter.format(end)}`;
}

type DayAvailability = {
  dayOfWeek: number;
  ranges: { startTime: string; endTime: string }[];
};

export function WeeklyAvailabilityForm() {
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load existing availability on mount
  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    try {
      setIsLoading(true);
      const slots = await getBarberAvailability();
      
      if (process.env.NODE_ENV === "development") {
        console.log("[WeeklyAvailabilityForm] Loaded availability slots:", slots.length);
      }
      
      // Group by dayOfWeek
      const grouped: DayAvailability[] = DAYS_OF_WEEK.map((day) => ({
        dayOfWeek: day.value,
        ranges: [],
      }));

      slots.forEach((slot) => {
        const day = grouped.find((d) => d.dayOfWeek === slot.dayOfWeek);
        if (day) {
          day.ranges.push({ startTime: slot.startTime, endTime: slot.endTime });
        }
      });

      setAvailability(grouped);
      
      if (process.env.NODE_ENV === "development") {
        console.log("[WeeklyAvailabilityForm] Pre-filled availability:", {
          daysWithRanges: grouped.filter(d => d.ranges.length > 0).length,
          totalRanges: grouped.reduce((sum, d) => sum + d.ranges.length, 0)
        });
      }
    } catch (error) {
      console.error("[WeeklyAvailabilityForm] Failed to load availability:", error);
      // Initialize with empty days
      setAvailability(
        DAYS_OF_WEEK.map((day) => ({ dayOfWeek: day.value, ranges: [] }))
      );
    } finally {
      setIsLoading(false);
    }
  };

  const addRange = (dayOfWeek: number) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              ranges: [...day.ranges, { startTime: "09:00", endTime: "17:00" }],
            }
          : day
      )
    );
  };

  const removeRange = (dayOfWeek: number, rangeIndex: number) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              ranges: day.ranges.filter((_, i) => i !== rangeIndex),
            }
          : day
      )
    );
  };

  const updateRange = (
    dayOfWeek: number,
    rangeIndex: number,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              ranges: day.ranges.map((range, i) => {
                if (i === rangeIndex) {
                  const updated = { ...range, [field]: value };
                  // Validate that startTime < endTime in real-time
                  if (field === "startTime" || field === "endTime") {
                    const [startH, startM] = updated.startTime.split(":").map(Number);
                    const [endH, endM] = updated.endTime.split(":").map(Number);
                    const startMinutes = startH * 60 + startM;
                    const endMinutes = endH * 60 + endM;
                    if (startMinutes >= endMinutes) {
                      // Show error but don't prevent update (will be caught on save)
                      console.warn("[WeeklyAvailabilityForm] Invalid time range:", {
                        day: dayOfWeek,
                        start: updated.startTime,
                        end: updated.endTime
                      });
                    }
                  }
                  return updated;
                }
                return range;
              }),
            }
          : day
      )
    );
    // Clear any previous error when user starts editing
    if (error) {
      setError(null);
    }
  };

  // Validate all ranges before saving
  const validateRanges = (): string | null => {
    for (const day of availability) {
      for (const range of day.ranges) {
        const [startH, startM] = range.startTime.split(":").map(Number);
        const [endH, endM] = range.endTime.split(":").map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        
        if (startMinutes >= endMinutes) {
          const dayName = DAYS_OF_WEEK.find(d => d.value === day.dayOfWeek)?.label || "Unknown";
          return `${dayName}: Start time must be before end time`;
        }
      }
    }
    return null;
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate all ranges first
      const validationError = validateRanges();
      if (validationError) {
        setError(validationError);
        setIsSaving(false);
        return;
      }

      // Flatten availability to array of slots
      const slots: AvailabilitySlot[] = [];
      availability.forEach((day) => {
        day.ranges.forEach((range) => {
          slots.push({
            dayOfWeek: day.dayOfWeek,
            startTime: range.startTime,
            endTime: range.endTime,
          });
        });
      });

      if (process.env.NODE_ENV === "development") {
        console.log("[WeeklyAvailabilityForm] Saving availability:", {
          rangesCount: slots.length,
          ranges: slots.map(s => ({
            day: DAYS_OF_WEEK.find(d => d.value === s.dayOfWeek)?.label,
            time: `${s.startTime}-${s.endTime}`
          }))
        });
      }

      const result = await saveBarberAvailability(slots);

      if (!result.success) {
        setError(result.error || "Failed to save availability");
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.log("[WeeklyAvailabilityForm] Successfully saved availability");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      // Reload availability to reflect server state
      await loadAvailability();
    } catch (error: any) {
      console.error("[WeeklyAvailabilityForm] Save error:", error);
      setError(error?.message || "Failed to save availability");
    } finally {
      setIsSaving(false);
    }
  };
  
  // Check if form has any ranges
  const hasRanges = availability.some(day => day.ranges.length > 0);
  
  // Check if all ranges are valid
  const hasValidRanges = validateRanges() === null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-zinc-500">Loading availability...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="bg-gradient-to-br from-slate-50 to-rose-50/30 rounded-t-2xl border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Clock className="w-5 h-5 text-rose-600" />
            Weekly Availability
          </CardTitle>
          <div className="flex flex-col sm:items-end gap-0.5">
            <span className="text-sm text-slate-600 font-normal flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {getCurrentWeekLabel()}
            </span>
            <span className="text-xs text-slate-500 italic">
              Hours repeat weekly
            </span>
          </div>
        </div>
        <CardDescription className="text-slate-600">
          Set your weekly working hours. Clients will see available slots based on these ranges.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-emerald-200 bg-emerald-50/80 shadow-sm">
            <AlertDescription className="text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Availability saved successfully!</span>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {DAYS_OF_WEEK.map((day) => {
            const dayData = availability.find((d) => d.dayOfWeek === day.value);
            const ranges = dayData?.ranges || [];

            return (
              <div
                key={day.value}
                className="border border-slate-200/60 rounded-xl p-4 space-y-3 bg-white/50 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium text-slate-900">{day.label}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addRange(day.value)}
                    className="flex items-center gap-1.5 rounded-full bg-rose-50/50 border-rose-200/50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-all duration-200 hover:scale-105"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Range
                  </Button>
                </div>

                {ranges.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Not available</p>
                ) : (
                  <div className="space-y-2">
                    {ranges.map((range, rangeIndex) => {
                      // Check if this range is invalid
                      const [startH, startM] = range.startTime.split(":").map(Number);
                      const [endH, endM] = range.endTime.split(":").map(Number);
                      const startMinutes = startH * 60 + startM;
                      const endMinutes = endH * 60 + endM;
                      const isInvalid = startMinutes >= endMinutes;

                      return (
                        <div
                          key={rangeIndex}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all duration-200 ${
                            isInvalid
                              ? "bg-red-50/50 border-red-200"
                              : "bg-gradient-to-r from-rose-50/30 to-amber-50/20 border-rose-200/50"
                          }`}
                        >
                          <Clock className={`w-3.5 h-3.5 ${isInvalid ? "text-red-500" : "text-rose-600"}`} />
                          <Input
                            type="time"
                            value={range.startTime}
                            onChange={(e) =>
                              updateRange(day.value, rangeIndex, "startTime", e.target.value)
                            }
                            className={`w-32 rounded-lg border-slate-200 ${
                              isInvalid ? "border-red-300" : ""
                            }`}
                          />
                          <span className="text-slate-400">–</span>
                          <Input
                            type="time"
                            value={range.endTime}
                            onChange={(e) =>
                              updateRange(day.value, rangeIndex, "endTime", e.target.value)
                            }
                            className={`w-32 rounded-lg border-slate-200 ${
                              isInvalid ? "border-red-300" : ""
                            }`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRange(day.value, rangeIndex)}
                            className="text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {isInvalid && (
                            <span className="text-xs text-red-600 ml-auto">
                              Start must be before end
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving || !hasRanges || !hasValidRanges}
          className="w-full rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
          size="lg"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Save Availability
            </>
          )}
        </Button>
        
        {hasRanges && !hasValidRanges && (
          <p className="text-sm text-amber-600 text-center">
            Please fix invalid time ranges before saving
          </p>
        )}
        
        {!hasRanges && (
          <p className="text-sm text-zinc-500 text-center">
            Add at least one time range to save availability
          </p>
        )}
      </CardContent>
    </Card>
  );
}

