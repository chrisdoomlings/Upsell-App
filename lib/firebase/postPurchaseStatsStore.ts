// Migrated to Supabase. Re-exported here so existing imports don't need to change.
export {
  trackPostPurchaseEvent,
  addPostPurchaseRevenue,
  getPostPurchaseOfferStats,
} from "@/lib/supabase/postPurchaseStatsStore";
export type { PostPurchaseEventType, PostPurchaseOfferStat } from "@/lib/supabase/postPurchaseStatsStore";
