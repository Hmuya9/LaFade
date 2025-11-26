"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

interface PointsData {
  points: number;
  signedIn: boolean;
}

export default function PointsBadge() {
  const { data: session } = useSession();
  const [pointsData, setPointsData] = useState<PointsData | null>(null);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/me")
        .then(r => r.json())
        .then(data => setPointsData(data))
        .catch(() => setPointsData({ points: 0, signedIn: false }));
    } else {
      setPointsData(null);
    }
  }, [session]);

  if (!pointsData?.signedIn) return null;

  return (
    <span className="ml-3 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-900">
      Points: {pointsData.points ?? 0}
    </span>
  );
}






