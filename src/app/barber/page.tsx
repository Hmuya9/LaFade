"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface AvailabilitySlot {
  id: number
  barberName: string
  date: string
  timeSlot: string
  isBooked: boolean
}

export default function BarberDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [newDate, setNewDate] = useState("")
  const [newTime, setNewTime] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (status === "loading") return
    
    if (!session || session.user?.role !== "BARBER") {
      router.push("/barber/login")
      return
    }
    
    fetchSlots()
  }, [session, status, router])

  const fetchSlots = async () => {
    try {
      const response = await fetch("/api/barber/availability")
      if (response.ok) {
        const data = await response.json()
        setSlots(data)
      }
    } catch (error) {
      console.error("Failed to fetch slots:", error)
    }
  }

  const addSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/barber/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, time: newTime }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to add slot")
      }

      setNewDate("")
      setNewTime("")
      fetchSlots()
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const deleteSlot = async (id: number) => {
    try {
      const response = await fetch(`/api/barber/availability/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete slot")
      }

      fetchSlots()
    } catch (error) {
      console.error("Failed to delete slot:", error)
    }
  }

  if (status === "loading") {
    return <div>Loading...</div>
  }

  if (!session || session.user?.role !== "BARBER") {
    return null
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">Barber Dashboard</h1>
          <p className="text-zinc-600">Manage your availability slots</p>
        </div>

        {error && (
          <Alert className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Add Slot Form */}
          <Card>
            <CardHeader>
              <CardTitle>Add New Slot</CardTitle>
              <CardDescription>Add a new availability slot</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={addSlot} className="space-y-4">
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                />
                <Input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  required
                />
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? "Adding..." : "Add Slot"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Existing Slots */}
          <Card>
            <CardHeader>
              <CardTitle>Existing Slots</CardTitle>
              <CardDescription>Your current availability</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {slots.length === 0 ? (
                  <p className="text-zinc-500">No slots added yet</p>
                ) : (
                  slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          {new Date(slot.date).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-zinc-600">{slot.timeSlot}</p>
                        <p className="text-xs text-zinc-500">
                          {slot.isBooked ? "Booked" : "Available"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteSlot(slot.id)}
                        disabled={slot.isBooked}
                      >
                        Delete
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}