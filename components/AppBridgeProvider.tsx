"use client";

import { useEffect, useState, type ReactNode } from "react";

interface AppBridgeProviderProps {
  children: ReactNode;
}

declare global {
  interface Window {
    shopify?: unknown;
  }
}

export default function AppBridgeProvider({ children }: AppBridgeProviderProps) {
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (typeof window === "undefined") return;
    if (window.shopify) {
      setReady(true);
      return;
    }

    const timeout = window.setTimeout(() => {
      setReady(Boolean(window.shopify));
    }, 3000);

    const interval = window.setInterval(() => {
      if (!window.shopify) return;
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      setReady(true);
    }, 50);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [mounted]);

  if (!mounted || !ready) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "200px",
          color: "#4b5563",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        Loading Shopify admin...
      </div>
    );
  }

  return <>{children}</>;
}
