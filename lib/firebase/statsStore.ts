// Migrated to Supabase. Re-exported here so existing imports don't need to change.
export {
  trackEvent,
  trackRevenueAttribution,
  getRuleStats,
  getRuleStatsByDay,
} from "@/lib/supabase/statsStore";
export type { EventType, RuleStat } from "@/lib/supabase/statsStore";
