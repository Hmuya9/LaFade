"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function ViewportDebugOverlay() {
  const searchParams = useSearchParams();
  const showDebug = searchParams?.get("debug") === "viewport" || process.env.NODE_ENV === "development";
  const [metrics, setMetrics] = useState({
    innerWidth: 0,
    clientWidth: 0,
    devicePixelRatio: 0,
    mdBreakpoint: false,
    userAgent: "",
  });

  useEffect(() => {
    if (!showDebug) return;

    const updateMetrics = () => {
      const mdQuery = window.matchMedia("(min-width: 768px)");
      setMetrics({
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        devicePixelRatio: window.devicePixelRatio,
        mdBreakpoint: mdQuery.matches,
        userAgent: navigator.userAgent,
      });
    };

    updateMetrics();
    window.addEventListener("resize", updateMetrics);
    window.addEventListener("orientationchange", updateMetrics);

    // Also check after a short delay to catch any late viewport changes
    const timeout = setTimeout(updateMetrics, 100);

    return () => {
      window.removeEventListener("resize", updateMetrics);
      window.removeEventListener("orientationchange", updateMetrics);
      clearTimeout(timeout);
    };
  }, [showDebug]);

  if (!showDebug) return null;

  const isProblematic = metrics.mdBreakpoint && metrics.innerWidth < 768;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] bg-black/90 text-white text-xs font-mono p-3 rounded-lg shadow-lg max-w-[90vw] border-2"
      style={{
        borderColor: isProblematic ? "#ef4444" : "#22c55e",
      }}
    >
      <div className="font-bold mb-2 text-yellow-300">Viewport Debug</div>
      <div className="space-y-1">
        <div>
          <span className="text-gray-400">innerWidth:</span>{" "}
          <span className={metrics.innerWidth >= 768 ? "text-red-400" : "text-green-400"}>
            {metrics.innerWidth}px
          </span>
        </div>
        <div>
          <span className="text-gray-400">clientWidth:</span>{" "}
          <span className={metrics.clientWidth >= 768 ? "text-red-400" : "text-green-400"}>
            {metrics.clientWidth}px
          </span>
        </div>
        <div>
          <span className="text-gray-400">devicePixelRatio:</span> {metrics.devicePixelRatio}
        </div>
        <div>
          <span className="text-gray-400">md breakpoint:</span>{" "}
          <span className={metrics.mdBreakpoint ? "text-red-400 font-bold" : "text-green-400"}>
            {metrics.mdBreakpoint ? "ACTIVE ⚠️" : "inactive"}
          </span>
        </div>
        {isProblematic && (
          <div className="text-red-400 font-bold mt-2 p-2 bg-red-900/30 rounded">
            ⚠️ PROBLEM: md: active but width &lt; 768px!
          </div>
        )}
        <div className="text-gray-400 text-[10px] mt-2 pt-2 border-t border-gray-700">
          {metrics.userAgent.substring(0, 60)}...
        </div>
      </div>
    </div>
  );
}

