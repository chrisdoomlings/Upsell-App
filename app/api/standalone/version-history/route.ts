import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyShop } from "@/lib/utils/standaloneSession";
import { getShop, updateShopSettings } from "@/lib/supabase/shopStore";
import { getLatestVersionEntry, getVersionHistory, normalizeVersionHistory } from "@/lib/versionHistory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuthenticatedShop(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie ? await verifyShop(cookie) : null;
}

export async function GET(req: NextRequest) {
  try {
    const shop = await getAuthenticatedShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const stored = await getShop(shop);
    const entries = getVersionHistory(stored?.settings?.versionHistory);

    return NextResponse.json({
      entries,
      latestEntry: getLatestVersionEntry(entries),
    });
  } catch (error) {
    console.error("[version-history] GET failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load version history" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const shop = await getAuthenticatedShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const entries = normalizeVersionHistory(body?.entries);
    if (entries.length === 0) {
      return NextResponse.json({ error: "Provide at least one valid version entry." }, { status: 400 });
    }

    const stored = await getShop(shop);
    await updateShopSettings(shop, {
      ...(stored?.settings ?? {}),
      versionHistory: entries,
    });

    return NextResponse.json({
      ok: true,
      entries,
      latestEntry: getLatestVersionEntry(entries),
    });
  } catch (error) {
    console.error("[version-history] PUT failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save version history" },
      { status: 500 },
    );
  }
}
