"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, CheckCircle2, Phone } from "lucide-react";

export function BarberCityForm() {
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current city and phone on mount
  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch("/api/barber/profile");
        if (response.ok) {
          const data = await response.json();
          setCity(data.city || "");
          setPhone(data.phone || "");
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      }
    }
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/barber/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          city: city.trim() || null,
          phone: phone.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.ok === false) {
        throw new Error(data.message || "Failed to save city");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save city");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-2xl shadow-sm border-slate-200/60 bg-white">
      <CardHeader className="bg-gradient-to-br from-slate-50 to-rose-50/40 rounded-t-2xl border-b">
        <CardTitle className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-rose-600" />
          Profile
        </CardTitle>
        <CardDescription className="text-slate-600">
          Set your location and contact info so clients can reach you
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="city" className="text-sm font-medium text-slate-700">
              City / Town
            </Label>
            <Input
              id="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g., Seattle, Bellevue, Tacoma"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
              Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., 425-524-2909"
              className="mt-2"
            />
            <p className="text-xs text-slate-500 mt-1">
              This will be shown to clients so they can contact you
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4" />
              Profile saved successfully
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white"
          >
            {loading ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}








