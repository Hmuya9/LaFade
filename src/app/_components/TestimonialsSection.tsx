"use client";

import { useEffect, useState } from "react";
import { ReviewCard } from "@/components/ReviewCard";

export function TestimonialsSection() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch("/api/reviews", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch reviews");
        }

        const data = await response.json();
        setReviews(data.reviews || []);
      } catch (error) {
        console.error("Error fetching reviews:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-zinc-100 rounded-lg h-48" />
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-600 text-lg">
          No testimonials yet. Be the first to share your experience!
        </p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      {reviews.slice(0, 3).map((review: any) => (
        <ReviewCard
          key={review.id}
          name={review.name}
          rating={review.rating}
          comment={review.comment}
          createdAt={review.createdAt}
        />
      ))}
    </div>
  );
}





