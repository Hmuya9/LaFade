"use client";

import { useEffect, useState } from "react";
import { createPusherClient } from "@/lib/pusher";
import { Card } from "@/components/ui/card";
import { TimeRangeClient } from "@/components/TimeRangeClient";

type BookingEvent = {
  appointmentId: string;
  clientId: string;
  barberId: string;
  startAt: string | Date;
  type: string;
  isFree: boolean;
  createdAt: string | Date;
};

export function RealtimeBookingsPanel() {
  const [events, setEvents] = useState<BookingEvent[]>([]);

  useEffect(() => {
    const pusher = createPusherClient();
    const channel = pusher.subscribe("lafade-bookings");

    const handler = (data: BookingEvent) => {
      setEvents((prev) => [data, ...prev].slice(0, 10));
    };

    channel.bind("booking.created", handler);

    return () => {
      channel.unbind("booking.created", handler);
      pusher.unsubscribe("lafade-bookings");
      pusher.disconnect();
    };
  }, []);

  if (!events.length) {
    return (
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-1">Live bookings</h2>
        <p className="text-sm text-muted-foreground">
          New bookings will appear here in real time.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Live bookings</h2>
        <span className="text-xs text-muted-foreground">
          Last {events.length} events
        </span>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {events.map((e) => {
          return (
            <div
              key={e.appointmentId}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium">
                  {e.isFree ? "Trial cut" : "Paid booking"}
                </span>
                <span className="text-xs text-muted-foreground">
                  <TimeRangeClient 
                    startAt={e.startAt} 
                    showDate={true}
                    dateFormat="EEE MMM d"
                    timeFormat="p"
                  />
                </span>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  e.isFree ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
                }`}
              >
                {e.type === "HOME" ? "Mobile" : "Shop"}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}






