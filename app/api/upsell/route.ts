import { NextRequest, NextResponse } from "next/server";
import { sessionStorage } from "@/lib/supabase/sessionStore";
import { getShopUpsellRulesMetafield } from "@/lib/shopify/shopUpsellRulesMetafield";
import { listUpsellRules } from "@/lib/shopify/upsellRuleStore";
import { ensureInstalledPublicShop } from "@/lib/utils/publicShopAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function normalizeProductId(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const gidMatch = raw.match(/gid:\/\/shopify\/Product\/(\d+)/);
  if (gidMatch?.[1]) return gidMatch[1];

  return raw;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const productId = normalizeProductId(searchParams.get("product_id"));
  const { shop, errorResponse } = await ensureInstalledPublicShop(searchParams.get("shop"));

  if (errorResponse || !productId) {
    return NextResponse.json({ upsells: [] }, { status: errorResponse?.status, headers: CORS });
  }

  try {
    const session = await sessionStorage.loadSession(`offline_${shop!}`);
    if (!session?.accessToken) return NextResponse.json({ upsells: [] }, { headers: CORS });

    let rules = await listUpsellRules(shop!, session.accessToken);
    if (!rules.length) {
      rules = await getShopUpsellRulesMetafield(shop!, session.accessToken);
    }

    const rule = rules.find((r) => {
      const triggerIds = Array.isArray(r.triggerProductIds) && r.triggerProductIds.length
        ? r.triggerProductIds
        : [r.triggerProductId];
      return triggerIds.some((id) => normalizeProductId(id) === productId);
    });
    if (!rule) return NextResponse.json({ upsells: [] }, { headers: CORS });

    const upsells = (rule.upsellProducts || []).map((p) => ({
      ruleId: rule.id,
      productId: p.productId,
      title: p.title,
      image: p.image,
      handle: p.handle,
      originalPrice: p.price,
      price:
        p.discountPercent > 0
          ? (parseFloat(p.price) * (1 - p.discountPercent / 100)).toFixed(2)
          : p.price,
      discountPercent: p.discountPercent,
      badgeText: p.badgeText || "",
      message: rule.message,
    }));

    return NextResponse.json({ upsells }, { headers: CORS });
  } catch (err) {
    console.error("[api/upsell]", err);
    return NextResponse.json({ upsells: [] }, { headers: CORS });
  }
}
