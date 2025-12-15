"use client";

import { useEffect, useState } from "react";
import { laf } from "@/components/ui/lafadeStyles";

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
          if (isMounted) setPhotos([]);
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

  if (!isLoading && photos.length === 0) return null;

  return (
    <section className={`${laf.card} ${laf.cardInner}`}>
      <div className={laf.cardPad}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className={laf.h2}>See the work</h2>
            <p className={laf.sub}>Real cuts from your barber&apos;s portfolio.</p>
          </div>
          <div className={`${laf.mono} text-xs text-zinc-500`}>{photos.length ? `${photos.length} shots` : ""}</div>
        </div>

        <div className={`${laf.divider} my-5`} />

        {isLoading ? (
          <p className="text-sm text-zinc-600">Loading photos...</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white"
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
      </div>
    </section>
  );
}
