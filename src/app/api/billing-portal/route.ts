import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Stripe from "stripe";

export async function POST() {
  const session = await auth();
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/signin", baseUrl));
  }
  
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
  
  // Look up or create customer by email
  const customers = await stripe.customers.list({ email: session.user.email, limit: 1 });
  const customer = customers.data[0] ?? await stripe.customers.create({ email: session.user.email });
  
  const portal = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: `${baseUrl}/account`,
  });
  
  return NextResponse.redirect(portal.url);
}
