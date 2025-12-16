"use client";

import Link from "next/link";
import { PLANS } from "@/config/plans";
import { PricingCard } from "@/components/PricingCard";
import { SkeletonList } from "@/components/ui/SkeletonList";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { PRICING, getPricingByPlanId, formatPrice } from "@/lib/pricing";
import { laf } from "@/components/ui/lafadeStyles";
import { COPY, SECOND_CUT_PRICE_CENTS, formatPrice as formatBusinessPrice } from "@/lib/lafadeBusiness";

type PlanFromDB = {
  id: string;
  name: string;
  priceMonthly: number;
  cutsPerMonth: number;
  isHome: boolean;
  stripePriceId: string;
};

type PlansClientProps = {
  hasUsedTrial: boolean;
};

export function PlansClient({ hasUsedTrial }: PlansClientProps) {
  const [loading, setLoading] = useState(false);
  const [dbPlans, setDbPlans] = useState<PlanFromDB[]>([]);
  const { data: session } = useSession();

  // Fetch plans from database (source of truth for Stripe price IDs)
  useEffect(() => {
    fetch("/api/plans")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.plans) {
          setDbPlans(data.plans);
          console.log("[plans] Fetched plans from database:", data.plans);
        }
      })
      .catch(err => {
        console.error("[plans] Failed to fetch plans from database:", err);
      });
  }, []);

  const handleClick = async (planId: string) => {
    setLoading(true);
    
    // For trial plan, go directly to booking
    if (planId === "trial") {
      window.location.href = "/booking?plan=trial";
      setLoading(false);
      return;
    }
    
    // For Standard and Deluxe, require authentication
    if (!session?.user) {
      const callbackUrl = encodeURIComponent("/plans");
      window.location.href = `/login?callbackUrl=${callbackUrl}`;
      setLoading(false);
      return;
    }
    
    // Find the plan in the database by matching planId ("standard" | "deluxe") to plan name.
    // This mapping is client-side only; the server resolves by primary key (plan.id).
    const dbPlan = dbPlans.find(p =>
      planId === "standard" && p.name.toLowerCase().includes("standard") ||
      planId === "deluxe" && p.name.toLowerCase().includes("deluxe")
    );

    if (!dbPlan) {
      alert(
        "We couldn't find this membership plan in our system. Please try again or contact support."
      );
      setLoading(false);
      return;
    }

    console.log("[plans] Starting subscription checkout", {
      planIdConfig: planId,
      planIdDb: dbPlan.id,
      planName: dbPlan.name,
      stripePriceIdPresent: !!dbPlan.stripePriceId,
    });
    
    // Use Stripe checkout for subscriptions
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: dbPlan.id }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorCode = errorData.code;
        const stripeError = errorData.stripe_error;
        const stripeCode = errorData.stripe_code;
        let errorMessage = errorData.error || errorData.stripe_error || `Checkout failed (${response.status})`;
        
        // In development, include Stripe error details if available
        if (process.env.NODE_ENV === "development" && stripeError) {
          errorMessage = `${errorMessage}${stripeCode ? ` (Stripe: ${stripeCode})` : ""}`;
        }
        
        console.error("[plans] Checkout creation failed:", {
          status: response.status,
          error: errorMessage,
          code: errorCode,
          stripeError,
          stripeCode,
          fullResponse: errorData,
        });

        // Handle specific error codes with custom messages
        if (errorCode === "ALREADY_MEMBER") {
          alert(errorMessage);
        } else if (errorCode === "STRIPE_NOT_CONFIGURED" || errorCode === "CONFIG_ERROR") {
          alert("Payment processing is not configured. Please contact support.");
        } else if (errorCode === "STRIPE_ERROR" || stripeError) {
          // For Stripe errors, show the user-friendly message (includes details in dev)
          alert(errorMessage);
        } else if (errorCode === "PLAN_NOT_FOUND") {
          alert(errorMessage);
        } else if (response.status >= 500) {
          // Generic message only for server errors (500s) without specific codes
          alert(`We couldn't start your checkout: ${errorMessage}. Please try again or contact support if this persists.`);
        } else {
          // For 400-level errors, show the specific error message
          alert(errorMessage);
        }
        
        setLoading(false);
        return;
      }
      
      const result = await response.json();
      
      if (result.url) {
        window.location.href = result.url;
      } else {
        console.error("[plans] No checkout URL in response:", result);
        alert("We couldn't start your checkout. Please verify Stripe configuration. If this persists, contact support.");
        setLoading(false);
      }
    } catch (error: any) {
      console.error("[plans] Checkout error:", error);
      alert(`We couldn't start your checkout: ${error?.message || "An unexpected error occurred"}. Please try again or contact support if this persists.`);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`${laf.page} ${laf.texture}`}>
        <div className={laf.container}>
          <header className="mb-8 text-center">
            <h1 className={laf.h1}>Choose Your Plan</h1>
          </header>
          <SkeletonList count={2} className="max-w-2xl mx-auto" />
        </div>
      </div>
    );
  }

  // Filter out trial plan if user has used it
  const filteredPlans = hasUsedTrial 
    ? PLANS.filter(plan => plan.id !== "trial")
    : PLANS;

  return (
    <div className={`${laf.page} ${laf.texture}`}>
      <div className={laf.container}>
        <header className="mb-8 text-center">
          <h1 className={laf.h1}>Plans</h1>
          <p className={laf.sub}>Engineered pricing. Clean value. No surprises.</p>
        </header>

        {/* How it works explainer */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className={`${laf.card} ${laf.cardPad}`}>
            <p className="text-zinc-600 leading-relaxed">
              Your LaFade journey is simple: your first cut is free, your second cut is only {formatBusinessPrice(SECOND_CUT_PRICE_CENTS)},
              and if you love it you can lock in a monthly membership so you never have to chase a barber again.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {filteredPlans.map((plan, idx) => {
            const pricingItem = getPricingByPlanId(plan.id as "trial" | "standard" | "deluxe");
            const isTrial = plan.id === "trial";
            
            return (
              <PricingCard
                key={plan.id}
                title={plan.name}
                price={isTrial ? formatPrice(pricingItem.cents) : `${formatPrice(pricingItem.cents)}/mo`}
                bullets={plan.bullets}
                onClick={() => handleClick(plan.id)}
                accent={idx === 1}
                buttonText={isTrial ? "Claim Free First Cut" : plan.id === "standard" ? "Get Standard Membership" : "Get Deluxe Membership"}
                highlightLine={(plan as any).highlightLine}
              />
            );
          })}
        </div>

        {/* Only show "Book a free test cut" link if user hasn't used trial */}
        {!hasUsedTrial && (
          <div className="text-center mt-8">
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
        )}
      </div>
    </div>
  );
}

