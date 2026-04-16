import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { sessionStorage } from "@/lib/firebase/sessionStore";
import { createBundleProduct } from "@/lib/shopify/bundleProductSync";
import type { BundleOfferItem } from "@/lib/shopify/bundleOfferStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getShop(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie ? await verifyShop(cookie) : null;
}

export async function POST(req: NextRequest) {
  try {
    const shop = await getShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await sessionStorage.loadSession(`offline_${shop}`);
    if (!session?.accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

    const body = await req.json();
    const product = await createBundleProduct(shop, session.accessToken, {
      title: String(body?.title ?? ""),
      offerName: String(body?.offerName ?? ""),
      compareAtPrice: String(body?.compareAtPrice ?? ""),
      discountedPrice: String(body?.discountedPrice ?? ""),
      items: Array.isArray(body?.items) ? (body.items as BundleOfferItem[]) : [],
    });

    return NextResponse.json({ ok: true, product });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create bundle product" },
      { status: 500 },
    );
  }
}
