"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { SignInButton } from "@/components/SignInButton";
import PointsBadge from "@/components/PointsBadge";

export function Navbar() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as "CLIENT" | "BARBER" | "OWNER" | undefined;
  
  const isOwner = role === "OWNER";
  const isBarber = role === "BARBER" || role === "OWNER";
  const isAuthenticated = !!session;
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo - Role-aware home link */}
          <Link 
            href={
              !session ? "/" : 
              role === "BARBER" ? "/barber" :
              role === "OWNER" ? "/admin/appointments" :
              "/account"
            } 
            className="text-2xl font-bold text-zinc-900 hover:text-amber-600 transition-colors"
          >
            {BRAND}
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {isAuthenticated && role === "CLIENT" && (
              <Link 
                href="/account" 
                className="text-zinc-700 hover:text-zinc-900 font-medium transition-colors"
              >
                Dashboard
              </Link>
            )}
            <Link 
              href="/plans" 
              className="text-zinc-700 hover:text-zinc-900 font-medium transition-colors"
            >
              Plans
            </Link>
            {isAuthenticated && (
              <Link 
                href="/booking" 
                className="text-zinc-700 hover:text-zinc-900 font-medium transition-colors"
              >
                Book Now
              </Link>
            )}
            {isBarber && (
              <Link 
                href="/barber" 
                className="text-zinc-700 hover:text-zinc-900 font-medium transition-colors"
              >
                Barber Dashboard
              </Link>
            )}
            {isOwner && (
              <Link 
                href="/admin" 
                className="text-zinc-700 hover:text-zinc-900 font-medium transition-colors"
              >
                Admin
              </Link>
            )}
            <SignInButton />
            {isAuthenticated && <PointsBadge />}
            <Button asChild>
              <Link href="/plans">Get Started</Link>
            </Button>
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
          <div id="mobile-menu" className="md:hidden border-t border-zinc-200 bg-white">
            <div className="py-4 space-y-4">
              {isAuthenticated && role === "CLIENT" && (
                <Link 
                  href="/account" 
                  className="block text-zinc-700 hover:text-zinc-900 font-medium transition-colors px-2 py-1"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Dashboard
                </Link>
              )}
              <Link 
                href="/plans" 
                className="block text-zinc-700 hover:text-zinc-900 font-medium transition-colors px-2 py-1"
                onClick={() => setIsMenuOpen(false)}
              >
                Plans
              </Link>
              {isAuthenticated && (
                <Link 
                  href="/booking" 
                  className="block text-zinc-700 hover:text-zinc-900 font-medium transition-colors px-2 py-1"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Book Now
                </Link>
              )}
              {isBarber && (
                <Link 
                  href="/barber" 
                  className="block text-zinc-700 hover:text-zinc-900 font-medium transition-colors px-2 py-1"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Barber Dashboard
                </Link>
              )}
              {isOwner && (
                <Link 
                  href="/admin" 
                  className="block text-zinc-700 hover:text-zinc-900 font-medium transition-colors px-2 py-1"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
              <div className="px-2">
                <Button asChild className="w-full">
                  <Link href="/plans" onClick={() => setIsMenuOpen(false)}>
                    Get Started
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}