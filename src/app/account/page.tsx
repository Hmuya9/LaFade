import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AccountPage() {
  const session = await auth();
  
  if (!session?.user) {
    return (
      <main className="max-w-3xl mx-auto py-16">
        <h1 className="text-2xl font-bold mb-4">Account</h1>
        <p>Please <Link href="/login" className="underline">sign in</Link> to view your account.</p>
      </main>
    );
  }

  const user = await prisma.user.findUnique({ 
    where: { email: session.user.email! }, 
    select: { id: true }
  });
  
  const agg = user ? await prisma.pointsLedger.aggregate({ 
    where: { userId: user.id }, 
    _sum: { delta: true }
  }) : { _sum: { delta: 0 }};
  
  const points = agg._sum.delta ?? 0;

  return (
    <main className="max-w-3xl mx-auto py-16 space-y-6">
      <h1 className="text-2xl font-bold">Account</h1>
      <div className="rounded-lg border p-4">
        <div className="text-sm text-gray-500">Points balance</div>
        <div className="text-3xl font-semibold">{points}</div>
      </div>
      <form action="/api/create-checkout-session" method="post">
        <button className="rounded-md bg-black text-white px-4 py-2">Subscribe</button>
      </form>
      <form action="/api/billing-portal" method="post">
        <button className="rounded-md border px-4 py-2">Manage Subscription</button>
      </form>
    </main>
  );
}
