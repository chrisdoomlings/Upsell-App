import { NextResponse } from "next/server";
import { getShop, saveShop } from "@/lib/supabase/shopStore";
import { sessionStorage } from "@/lib/supabase/sessionStore";

const SHOP_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export function normalizePublicShop(rawShop: string | null | undefined): string | null {
  const shop = (rawShop ?? "").trim().toLowerCase();
  if (!shop || !SHOP_PATTERN.test(shop)) return null;
  return shop;
}

export async function ensureInstalledPublicShop(rawShop: string | null | undefined) {
  const shop = normalizePublicShop(rawShop);
  if (!shop) {
    return {
      shop: null,
      errorResponse: NextResponse.json({ error: "Invalid shop" }, { status: 400 }),
    };
  }

  let stored = await getShop(shop);
  if (!stored?.installedAt || stored.uninstalledAt) {
    // Auto-heal installs where the offline session exists but the shop row
    // was never persisted (or was left marked uninstalled).
    const session = await sessionStorage.loadSession(`offline_${shop}`);
    if (session?.accessToken) {
      await saveShop(shop, {
        installedAt: stored?.installedAt ?? new Date().toISOString(),
        uninstalledAt: null,
      });
      stored = await getShop(shop);
    }
  }

  if (!stored?.installedAt || stored.uninstalledAt) {
    return {
      shop: null,
      errorResponse: NextResponse.json({ error: "Unknown shop" }, { status: 404 }),
    };
  }

  return { shop, stored, errorResponse: null };
}
