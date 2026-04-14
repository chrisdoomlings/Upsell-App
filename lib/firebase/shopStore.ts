// Shop data is stored in Supabase. Keep this Firebase-path wrapper as the
// active import path for the codebase.
export {
  saveShop,
  getShop,
  markUninstalled,
  updateShopSettings,
  deleteShopAllData,
  listShops,
} from "@/lib/supabase/shopStore";
export type { ShopData } from "@/lib/supabase/shopStore";
