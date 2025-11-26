"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PortfolioPhoto = {
  id: string;
  url: string;
  createdAt: string;
};

type BookingPortfolioSectionProps = {
  barberId?: string;
};

export function BookingPortfolioSection({ barberId }: BookingPortfolioSectionProps) {
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchPhotos() {
      try {
        setIsLoading(true);

        const url = barberId
          ? `/api/photos/portfolio?barberId=${encodeURIComponent(barberId)}`
          : `/api/photos/portfolio`;

        const res = await fetch(url);
        if (!res.ok) {
          if (isMounted) {
            setPhotos([]);
          }
          return;
        }

        const data = await res.json();
        if (isMounted && Array.isArray(data.photos)) {
          setPhotos(data.photos);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchPhotos();
    return () => {
      isMounted = false;
    };
  }, [barberId]);

  if (!isLoading && photos.length === 0) {
    // If there are no photos, quietly render nothing so the booking page
    // doesn't look broken when portfolio is empty.
    return null;
  }

  return (
    <Card className="rounded-2xl shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-xl font-semibold">See the work</CardTitle>
            <CardDescription className="text-sm">
              Real cuts from your barber&apos;s portfolio.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-zinc-600">Loading photos...</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative rounded-md overflow-hidden border bg-zinc-100"
              >
                <img
                  src={photo.url}
                  alt="Example haircut"
                  className="w-full h-20 sm:h-24 object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

