import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { sessionStorage } from "@/lib/supabase/sessionStore";
import { listBxgyRules } from "@/lib/shopify/bxgyRuleStore";
import { getBxgyRuleStats } from "@/lib/supabase/bxgyStatsStore";
import { explainDatabaseError } from "@/lib/supabase/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get(COOKIE_NAME)?.value;
    const shop = cookie ? await verifyShop(cookie) : null;
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await sessionStorage.loadSession(`offline_${shop}`);
    if (!session?.accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

    const rules = await listBxgyRules(shop, session.accessToken);
    const stats = await getBxgyRuleStats(shop, rules.map((rule) => rule.id));

    const merged = stats.map((stat) => {
      const rule = rules.find((entry) => entry.id === stat.ruleId);
      return {
        ...stat,
        name: rule?.name ?? "Buy X Get Y",
        buyLabel: rule?.appliesToAnyProduct ? "Any product in store" : rule?.buyProducts.map((product) => product.title).join(", ") ?? "",
        giftLabel: rule?.giftProduct?.title ?? "",
        message: rule?.message ?? "",
      };
    });

    const totalQualified = merged.reduce((sum, stat) => sum + stat.qualified, 0);
    const totalAutoAdded = merged.reduce((sum, stat) => sum + stat.autoAdded, 0);

    return NextResponse.json({
      rules: merged,
      summary: {
        activeRules: rules.filter((rule) => rule.enabled).length,
        totalQualified,
        totalAutoAdded,
        conversionRate: totalQualified > 0 ? `${((totalAutoAdded / totalQualified) * 100).toFixed(1)}%` : "-",
      },
    });
  } catch (error) {
    console.error("[bxgy-stats] GET failed", error);
    return NextResponse.json(
      { error: explainDatabaseError(error, "Failed to load BXGY stats") },
      { status: 500 },
    );
  }
}
