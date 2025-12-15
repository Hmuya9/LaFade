"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { SignInButton } from "@/components/SignInButton";
import { getDashboardRouteForRole } from "@/lib/auth";

type NavItem = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export function Navbar() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as "CLIENT" | "BARBER" | "OWNER" | undefined;
  
  const isClient = role === "CLIENT";
  const isBarber = role === "BARBER" || role === "OWNER";
  const isLoggedIn = !!session;
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Build nav items based on role
  const navItems: NavItem[] = [];
  
  if (!isLoggedIn) {
    // Logged-out users: Plans, Book Now, Sign In, Get Started
    navItems.push(
      { label: "Plans", href: "/plans" },
      { label: "Book Now", href: "/booking" }
    );
  } else if (isClient) {
    // CLIENT: Plans, Book Now, Dashboard
    const dashboardRoute = getDashboardRouteForRole(role);
    navItems.push(
      { label: "Plans", href: "/plans" },
      { label: "Book Now", href: "/booking" },
      { label: "Dashboard", href: dashboardRoute }
    );
  } else if (isBarber) {
    // BARBER/OWNER: Dashboard only
    const dashboardRoute = getDashboardRouteForRole(role);
    navItems.push(
      { label: "Dashboard", href: dashboardRoute }
    );
  }

  return (
    <nav className="bg-white/70 backdrop-blur-md border-b border-zinc-200/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo - Role-aware home link */}
          <Link 
            href={
              !session ? "/" : 
              getDashboardRouteForRole(role)
            } 
            className="text-2xl font-bold text-zinc-900 hover:text-amber-600 transition-colors"
          >
            {BRAND}
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href || "#"}
                className="text-zinc-700 hover:text-zinc-900 font-medium transition-colors"
                onClick={item.onClick}
              >
                {item.label}
              </Link>
            ))}
            {isBarber && role === "OWNER" && (
              <Link 
                href="/admin" 
                className="text-zinc-700 hover:text-zinc-900 font-medium transition-colors"
              >
                Admin
              </Link>
            )}
            <SignInButton />
            {!isLoggedIn && (
              <Button asChild>
                <Link href="/plans">Get Started</Link>
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
          >
            <div className="space-y-1">
              <div className={`w-6 h-0.5 bg-zinc-900 transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></div>
              <div className={`w-6 h-0.5 bg-zinc-900 transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></div>
              <div className={`w-6 h-0.5 bg-zinc-900 transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></div>
            </div>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div id="mobile-menu" className="md:hidden border-t border-zinc-200/60 bg-white/70 backdrop-blur-md">
            <div className="py-4 space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href || "#"}
                  className="block text-zinc-700 hover:text-zinc-900 font-medium transition-colors px-2 py-1"
                  onClick={() => {
                    setIsMenuOpen(false);
                    item.onClick?.();
                  }}
                >
                  {item.label}
                </Link>
              ))}
              {isBarber && role === "OWNER" && (
                <Link 
                  href="/admin" 
                  className="block text-zinc-700 hover:text-zinc-900 font-medium transition-colors px-2 py-1"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
              <div className="px-2">
                <SignInButton />
              </div>
              {!isLoggedIn && (
                <div className="px-2">
                  <Button asChild className="w-full">
                    <Link href="/plans" onClick={() => setIsMenuOpen(false)}>
                      Get Started
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}