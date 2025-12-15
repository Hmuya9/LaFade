import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/config/plans";
import { BRAND } from "@/lib/brand";
import { TestimonialsSection } from "./_components/TestimonialsSection";
import { PRICING, getPricingByPlanId, formatPrice } from "@/lib/pricing";

export default async function Home() {
  // Check if user is logged in and redirect based on role
  const session = await auth();
  
  if (session?.user) {
    const role = (session.user as any)?.role;
    if (role === "CLIENT") {
      redirect("/account");
    } else if (role === "BARBER") {
      redirect("/barber");
    } else if (role === "OWNER") {
      redirect("/admin/appointments");
    }
  }
  return (
    <main className="min-h-screen bg-zinc-50">
      {/* Hero Section */}
      <section className="relative px-6 py-32 text-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-amber-500/5"></div>
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-6xl font-bold text-white mb-6 tracking-tight">
            {BRAND}
          </h1>
          <p className="text-2xl text-zinc-300 mb-4 font-light">
            Premium Haircut Subscriptions
          </p>
          <p className="text-lg text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Consistent, professional cuts delivered on your schedule. 
            Never worry about booking again.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link 
              href="/plans" 
              className="inline-flex items-center px-8 py-4 bg-amber-500 text-zinc-900 font-semibold rounded-xl hover:bg-amber-400 transition-all duration-200 text-lg shadow-xl hover:shadow-2xl motion-safe:transform motion-safe:hover:-translate-y-0.5"
            >
              <span className="mr-2">📱</span>
              Start Your Subscription
            </Link>
            <a 
              href={process.env.NEXT_PUBLIC_CALENDLY_URL || "/booking"}
              className="inline-flex items-center px-8 py-4 border-2 border-zinc-600 text-zinc-300 font-semibold rounded-xl hover:border-zinc-500 hover:text-white transition-all duration-200"
              target={process.env.NEXT_PUBLIC_CALENDLY_URL ? "_blank" : undefined}
              rel={process.env.NEXT_PUBLIC_CALENDLY_URL ? "noopener noreferrer" : undefined}
            >
              Book Free Test Cut
            </a>
          </div>
        </div>
      </section>

      {/* Plans Section */}
      <section id="plans" className="px-6 py-24 bg-zinc-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-zinc-900 mb-4">
              Choose Your Plan
            </h2>
            <p className="text-xl text-zinc-600 max-w-2xl mx-auto">
              Professional cuts, consistent quality, predictable pricing.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {PLANS.map((plan, idx) => (
              <Card key={plan.id} className={`rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-200 ${
                idx === 1 ? "border-2 border-amber-500 relative" : ""
              }`}>
                {idx === 1 && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-amber-500 text-zinc-900 px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl font-bold text-zinc-900 mb-2">{plan.name}</CardTitle>
                  <div className="text-4xl font-bold text-zinc-900 mb-1">
                    {formatPrice(getPricingByPlanId(plan.id as "trial" | "standard" | "deluxe").cents)}
                  </div>
                  <CardDescription className="text-zinc-600 mb-6">per month</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-left space-y-3 mb-8">
                    {plan.bullets.map((bullet, bulletIdx) => (
                      <li key={bulletIdx} className="flex items-start">
                        <span className="text-green-500 mr-3 mt-0.5">✓</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <Link 
                    href="/plans" 
                    className={`block w-full text-center py-3 rounded-xl font-semibold transition-colors ${
                      idx === 1 
                        ? "bg-amber-500 text-zinc-900 hover:bg-amber-400" 
                        : "bg-zinc-900 text-white hover:bg-zinc-800"
                    }`}
                  >
                    Get Started
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-24 bg-white">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-4xl font-bold text-center text-zinc-900 mb-4">
            How It Works
          </h3>
          <p className="text-xl text-zinc-600 text-center mb-16 max-w-2xl mx-auto">
            Simple subscription process designed for busy professionals
          </p>
          <div className="grid md:grid-cols-3 gap-12 text-center">
            <div className="group">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-amber-600 text-zinc-900 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 group-hover:scale-110 transition-transform duration-200">
                1
              </div>
              <h4 className="text-xl font-semibold text-zinc-900 mb-3">Choose Your Plan</h4>
              <p className="text-zinc-600 leading-relaxed">Select the subscription that fits your lifestyle. All plans include premium service and quality guarantee.</p>
            </div>
            <div className="group">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-amber-600 text-zinc-900 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 group-hover:scale-110 transition-transform duration-200">
                2
              </div>
              <h4 className="text-xl font-semibold text-zinc-900 mb-3">Schedule Your Cuts</h4>
              <p className="text-zinc-600 leading-relaxed">Book your appointments easily. Flexible scheduling that works around your busy schedule.</p>
            </div>
            <div className="group">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-amber-600 text-zinc-900 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 group-hover:scale-110 transition-transform duration-200">
                3
              </div>
              <h4 className="text-xl font-semibold text-zinc-900 mb-3">Stay Sharp</h4>
              <p className="text-zinc-600 leading-relaxed">Consistent professional cuts delivered on time. Focus on your success, we&apos;ll handle your style.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Le Fade */}
      <section className="px-6 py-24 bg-zinc-900">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-4xl font-bold text-white mb-6">
            Why {BRAND}?
          </h3>
          <p className="text-xl text-zinc-300 mb-12 max-w-2xl mx-auto">
            We understand that time is your most valuable asset. Our subscription model eliminates the hassle while delivering consistent professional results.
          </p>
          <div className="grid md:grid-cols-2 gap-8 text-left">
            <Card className="bg-zinc-800 border-zinc-700 p-6">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-white mb-3">Consistency Guaranteed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-300">Same quality, same style, every time. Our professional barbers maintain detailed notes of your preferences.</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-800 border-zinc-700 p-6">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-white mb-3">Time Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-300">No more calling around or waiting for appointments. Your slots are reserved, your schedule is protected.</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-800 border-zinc-700 p-6">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-white mb-3">Premium Service</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-300">Professional-grade equipment, quality products, and skilled barbers focused on your satisfaction.</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-800 border-zinc-700 p-6">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-white mb-3">Flexible Options</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-300">Shop visits or home service. Choose what works best for your lifestyle and schedule.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-24 bg-zinc-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-zinc-900 mb-6">
              What Our Clients Say
            </h3>
            <p className="text-xl text-zinc-600 max-w-2xl mx-auto">
              Don&apos;t just take our word for it. Here&apos;s what professionals like you have to say about {BRAND}.
            </p>
          </div>
          <TestimonialsSection />
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-24 bg-gradient-to-br from-amber-500 to-amber-600">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-4xl font-bold text-zinc-900 mb-6">
            Ready to Transform Your Routine?
          </h3>
          <p className="text-xl text-zinc-900/80 mb-12 max-w-2xl mx-auto">
            Join successful professionals who trust {BRAND} for their grooming needs. Start with your first cut free.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link 
              href="/plans" 
              className="inline-flex items-center px-8 py-4 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 transition-all duration-200 text-lg shadow-xl motion-safe:transform motion-safe:hover:-translate-y-0.5"
            >
              <span className="mr-2">📱</span>
              Start Your Subscription
            </Link>
            <a 
              href={process.env.NEXT_PUBLIC_CALENDLY_URL || "/booking"}
              className="inline-flex items-center px-8 py-4 border-2 border-zinc-900 text-zinc-900 font-semibold rounded-xl hover:bg-zinc-900 hover:text-white transition-all duration-200"
              target={process.env.NEXT_PUBLIC_CALENDLY_URL ? "_blank" : undefined}
              rel={process.env.NEXT_PUBLIC_CALENDLY_URL ? "noopener noreferrer" : undefined}
            >
              Ask Questions
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

