import { getDb } from "@/lib/supabase/client";

export type EventType = "view" | "click" | "added";

export interface RuleStat {
  ruleId: string;
  views: number;
  clicks: number;
  added: number;
  orders: number;
  units: number;
  revenue: number;
  ctr: string;
  convRate: string;
  addRate: string;
  revenuePerView: number;
  revenuePerClick: number;
  revenuePerOrder: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function trackEvent(shop: string, ruleId: string, event: EventType): Promise<void> {
  const db = getDb();
  const col = event === "view" ? "views" : event === "click" ? "clicks" : "added";
  await db`
    INSERT INTO upsell_stats (shop, rule_id, date, views, clicks, added)
    VALUES (${shop}, ${ruleId}, ${todayKey()}::date, 0, 0, 0)
    ON CONFLICT (shop, rule_id, date) DO UPDATE SET
      ${db.unsafe(col)} = upsell_stats.${db.unsafe(col)} + 1
  `;
}

export async function trackRevenueAttribution(
  shop: string,
  ruleId: string,
  revenue: number,
  orderCountDelta: number,
  unitsDelta = 0,
): Promise<void> {
  if (!Number.isFinite(revenue) && !Number.isFinite(orderCountDelta) && !Number.isFinite(unitsDelta)) return;
  const db = getDb();
  await db`
    INSERT INTO upsell_stats (shop, rule_id, date, revenue, orders, units)
    VALUES (
      ${shop}, ${ruleId}, ${todayKey()}::date,
      ${Number.isFinite(revenue) ? revenue : 0},
      ${Number.isFinite(orderCountDelta) ? orderCountDelta : 0},
      ${Number.isFinite(unitsDelta) ? unitsDelta : 0}
    )
    ON CONFLICT (shop, rule_id, date) DO UPDATE SET
      revenue = upsell_stats.revenue + EXCLUDED.revenue,
      orders  = upsell_stats.orders  + EXCLUDED.orders,
      units   = upsell_stats.units   + EXCLUDED.units
  `;
}

export async function getRuleStats(shop: string, ruleIds: string[]): Promise<RuleStat[]> {
  if (!ruleIds.length) return [];
  const db = getDb();
  const rows = await db`
    SELECT rule_id,
           SUM(views)   AS views,
           SUM(clicks)  AS clicks,
           SUM(added)   AS added,
           SUM(orders)  AS orders,
           SUM(units)   AS units,
           SUM(revenue) AS revenue
    FROM upsell_stats
    WHERE shop = ${shop} AND rule_id = ANY(${ruleIds})
    GROUP BY rule_id
  `;

  return ruleIds.map((ruleId) => {
    const row = rows.find((r) => String((r as Record<string, unknown>).rule_id) === ruleId) as Record<string, unknown> | undefined;
    const views   = Number(row?.views)   || 0;
    const clicks  = Number(row?.clicks)  || 0;
    const added   = Number(row?.added)   || 0;
    const orders  = Number(row?.orders)  || 0;
    const units   = Number(row?.units)   || 0;
    const revenue = Number(row?.revenue) || 0;
    return {
      ruleId,
      views, clicks, added, orders, units, revenue,
      ctr:              views  > 0 ? ((clicks / views)  * 100).toFixed(1) + "%" : "-",
      convRate:         clicks > 0 ? ((added  / clicks) * 100).toFixed(1) + "%" : "-",
      addRate:          views  > 0 ? ((added  / views)  * 100).toFixed(1) + "%" : "-",
      revenuePerView:   views  > 0 ? revenue / views   : 0,
      revenuePerClick:  clicks > 0 ? revenue / clicks  : 0,
      revenuePerOrder:  orders > 0 ? revenue / orders  : 0,
    };
  });
}

export async function getRuleStatsByDay(shop: string, ruleId: string) {
  const db = getDb();
  const rows = await db`
    SELECT date, views, clicks, added, orders, units, revenue
    FROM upsell_stats
    WHERE shop = ${shop} AND rule_id = ${ruleId}
    ORDER BY date ASC
  `;
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      date:    String(r.date).slice(0, 10),
      views:   Number(r.views)   || 0,
      clicks:  Number(r.clicks)  || 0,
      added:   Number(r.added)   || 0,
      orders:  Number(r.orders)  || 0,
      units:   Number(r.units)   || 0,
      revenue: Number(r.revenue) || 0,
    };
  });
}
