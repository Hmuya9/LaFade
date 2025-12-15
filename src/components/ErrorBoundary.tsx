"use client";

import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    // Always log errors, but gate detailed logging in production
    if (process.env.NODE_ENV === "production") {
      console.error("ErrorBoundary caught:", error?.message || String(error));
      // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    } else {
      console.error("ErrorBoundary caught:", error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold">Something went wrong.</h1>
          <p className="text-zinc-500 mt-2">Please refresh the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}





