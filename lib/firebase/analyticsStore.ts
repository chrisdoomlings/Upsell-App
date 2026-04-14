// Migrated to Supabase. Re-exported here so existing imports don't need to change.
export {
  incrementDailyOrder,
  decrementDailyOrder,
  getOrderStats,
  buildDateRange,
} from "@/lib/supabase/analyticsStore";
export type { DailyOrderStat, AnalyticsSummary } from "@/lib/supabase/analyticsStore";
