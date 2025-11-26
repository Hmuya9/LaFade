"use client";

import Link from "next/link";
import { PLANS } from "@/config/plans";
import { PricingCard } from "@/components/PricingCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SkeletonList } from "@/components/ui/SkeletonList";
import { useState } from "react";

export default function PlansPage() {
  const [loading, setLoading] = useState(false);
  
  // Use NEXT_PUBLIC_ env vars directly in client components
  const stripeStandard = process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD || "";
  const stripeDeluxe = process.env.NEXT_PUBLIC_STRIPE_PRICE_DELUXE || "";
  const linkStandard = process.env.NEXT_PUBLIC_STRIPE_LINK_STANDARD || "";
  const linkDeluxe = process.env.NEXT_PUBLIC_STRIPE_LINK_DELUXE || "";
  const calendly = process.env.NEXT_PUBLIC_CALENDLY_URL || "";
  
  const missingStripe = !stripeStandard || !stripeDeluxe;

  const handleClick = async (planId: string) => {
    setLoading(true);
    
    // For trial plan, go directly to booking
    if (planId === "trial") {
      window.location.href = "/booking?plan=trial";
      setLoading(false);
      return;
    }
    
    if (missingStripe) {
      // Use payment links as fallback
      const link = planId === "standard" ? linkStandard : linkDeluxe;
      if (link) {
        window.open(link, "_blank");
      } else {
        // Fallback to Calendly for booking
        if (calendly) {
          window.open(calendly, "_blank");
        }
      }
    } else {
      // Use Stripe checkout
      try {
        const response = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priceId: planId === "standard" ? stripeStandard : stripeDeluxe }),
        });
        const { url } = await response.json();
        if (url) {
          window.location.href = url;
        }
      } catch (error) {
        // TODO: Add proper error logging service
        // Fallback to payment links
        const link = planId === "standard" ? linkStandard : linkDeluxe;
        if (link) {
          window.open(link, "_blank");
        } else {
          alert("Payment system is temporarily unavailable. Please try again later.");
        }
      }
    }
    
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          </div>
          <SkeletonList count={2} className="max-w-2xl mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-16">
      <div className="max-w-4xl mx-auto px-6 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-zinc-600 max-w-2xl mx-auto">
            Professional cuts, consistent quality, predictable pricing.
          </p>
        </div>

        {missingStripe && (
          <Alert variant="warning">
            <AlertDescription>
              We&apos;re finalizing payments. You can still subscribe via our secure Stripe link or book a free test cut.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {PLANS.map((plan, idx) => (
            <PricingCard
              key={plan.id}
              title={plan.name}
              price={`$${(plan.priceMonthlyCents/100).toFixed(2)}/mo`}
              bullets={plan.bullets}
              onClick={() => handleClick(plan.id)}
              accent={idx === 1}
              buttonText={plan.id === "trial" ? "Start Free Trial" : plan.id === "standard" ? "Get Standard" : "Get Deluxe"}
            />
          ))}
        </div>

        <div className="text-center">
          <p className="text-zinc-600 mb-4">
            Want to try before you subscribe?
          </p>
          <Link 
            href="/booking?plan=trial"
            className="text-amber-600 hover:text-amber-700 underline font-medium"
          >
            Book a free test cut →
          </Link>
        </div>
      </div>
    </div>
  );
}