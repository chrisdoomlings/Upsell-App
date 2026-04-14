import { getDb } from "@/lib/supabase/client";

export type PostPurchaseEventType = "viewed" | "accepted";

export interface PostPurchaseOfferStat {
  offerId: string;
  viewed: number;
  accepted: number;
  revenue: number;
  conversionRate: string;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function trackPostPurchaseEvent(
  shop: string,
  offerId: string,
  event: PostPurchaseEventType,
): Promise<void> {
  const db = getDb();
  const col = event === "viewed" ? "viewed" : "accepted";
  await db`
    INSERT INTO post_purchase_stats (shop, offer_id, date, viewed, accepted, revenue)
    VALUES (${shop}, ${offerId}, ${todayKey()}::date, 0, 0, 0)
    ON CONFLICT (shop, offer_id, date) DO UPDATE SET
      ${db.unsafe(col)} = post_purchase_stats.${db.unsafe(col)} + 1
  `;
}

export async function addPostPurchaseRevenue(
  shop: string,
  offerId: string,
  revenue: number,
): Promise<void> {
  const db = getDb();
  await db`
    INSERT INTO post_purchase_stats (shop, offer_id, date, viewed, accepted, revenue)
    VALUES (${shop}, ${offerId}, ${todayKey()}::date, 0, 0, ${revenue})
    ON CONFLICT (shop, offer_id, date) DO UPDATE SET
      revenue = post_purchase_stats.revenue + EXCLUDED.revenue
  `;
}

export async function getPostPurchaseOfferStats(
  shop: string,
  offerIds: string[],
): Promise<PostPurchaseOfferStat[]> {
  if (!offerIds.length) return [];
  const db = getDb();
  const rows = await db`
    SELECT offer_id,
           SUM(viewed)   AS viewed,
           SUM(accepted) AS accepted,
           SUM(revenue)  AS revenue
    FROM post_purchase_stats
    WHERE shop = ${shop} AND offer_id = ANY(${offerIds})
    GROUP BY offer_id
  `;

  return offerIds.map((offerId) => {
    const row = rows.find((r) => String((r as Record<string, unknown>).offer_id) === offerId) as Record<string, unknown> | undefined;
    const viewed   = Number(row?.viewed)   || 0;
    const accepted = Number(row?.accepted) || 0;
    const revenue  = Number(row?.revenue)  || 0;
    return {
      offerId,
      viewed,
      accepted,
      revenue,
      conversionRate: viewed > 0 ? `${((accepted / viewed) * 100).toFixed(1)}%` : "—",
    };
  });
}
