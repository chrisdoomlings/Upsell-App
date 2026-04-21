import { getDb } from "@/lib/supabase/client";

export interface DailyOrderStat {
  date: string;
  count: number;
  revenue: number;
  upsaleRevenue: number;
  currency: string;
}

export interface AnalyticsSummary {
  totalOrders: number;
  totalRevenue: number;
  totalUpsaleRevenue: number;
  currency: string;
  avgOrderValue: number;
  daily: DailyOrderStat[];
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function incrementDailyOrder(
  shop: string,
  revenue: number,
  currency: string,
  date: string = todayKey(),
  upsaleRevenue = 0,
): Promise<void> {
  const db = getDb();
  await db`
    INSERT INTO analytics (shop, date, count, revenue, upsale_revenue, currency)
    VALUES (${shop}, ${date}::date, 1, ${revenue}, ${upsaleRevenue}, ${currency})
    ON CONFLICT (shop, date) DO UPDATE SET
      count         = analytics.count + 1,
      revenue       = analytics.revenue + EXCLUDED.revenue,
      upsale_revenue = analytics.upsale_revenue + EXCLUDED.upsale_revenue,
      currency      = EXCLUDED.currency
  `;
}

export async function decrementDailyOrder(
  shop: string,
  revenue: number,
  date: string = todayKey(),
): Promise<void> {
  const db = getDb();
  await db`
    UPDATE analytics SET
      count   = GREATEST(0, count - 1),
      revenue = GREATEST(0, revenue - ${revenue})
    WHERE shop = ${shop} AND date = ${date}::date
  `;
}

export async function getOrderStats(
  shop: string,
  startDate: string,
  endDate: string,
): Promise<AnalyticsSummary> {
  const db = getDb();
  const rows = await db`
    SELECT date, count, revenue, upsale_revenue, currency
    FROM analytics
    WHERE shop = ${shop}
      AND date >= ${startDate}::date
      AND date <= ${endDate}::date
    ORDER BY date ASC
  `;

  let totalOrders = 0;
  let totalRevenue = 0;
  let totalUpsaleRevenue = 0;
  let currency = "USD";
  const daily: DailyOrderStat[] = [];

  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const count = Number(r.count) || 0;
    const rev = Number(r.revenue) || 0;
    const upsaleRev = Number(r.upsale_revenue) || 0;
    currency = String(r.currency || "USD");
    totalOrders += count;
    totalRevenue += rev;
    totalUpsaleRevenue += upsaleRev;
    daily.push({
      date: String(r.date).slice(0, 10),
      count,
      revenue: rev,
      upsaleRevenue: upsaleRev,
      currency,
    });
  }

  return {
    totalOrders,
    totalRevenue,
    totalUpsaleRevenue,
    currency,
    avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    daily,
  };
}

export function buildDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { startDate: dayKey(start), endDate: dayKey(end) };
}
