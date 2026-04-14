// Migrated to Supabase. Re-exported here so existing imports don't need to change.
export {
  saveShop,
  getShop,
  markUninstalled,
  updateShopSettings,
  deleteShopAllData,
  listShops,
} from "@/lib/supabase/shopStore";
export type { ShopData } from "@/lib/supabase/shopStore";
