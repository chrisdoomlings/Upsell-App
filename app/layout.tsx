import type { Metadata } from "next";
import Script from "next/script";
import PolarisProvider from "@/components/PolarisProvider";

export const metadata: Metadata = {
  title: "Doomlings App",
  description: "Doomlings App — Shopify Admin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" strategy="beforeInteractive" />
      </head>
      <body>
        <PolarisProvider>{children}</PolarisProvider>
      </body>
    </html>
  );
}
