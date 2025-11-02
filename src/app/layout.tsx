import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { BRAND } from "@/lib/brand";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: `${BRAND} - Look Sharp, Always`,
  description: `Professional haircut subscriptions for busy professionals. Standard and Deluxe plans with consistent quality and flexible scheduling.`,
  keywords: "haircut subscription, professional haircuts, barber service, mobile barber, premium grooming",
  openGraph: {
    title: `${BRAND} - Look Sharp, Always`,
    description: "Professional haircut subscriptions for busy professionals",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} min-h-screen bg-zinc-50 text-zinc-900 antialiased`}
      >
        <Providers>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}

