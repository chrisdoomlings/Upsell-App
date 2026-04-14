// Legacy compatibility wrapper. Prefer importing from "@/lib/shopStore".
export {
  saveShop,
  getShop,
  markUninstalled,
  updateShopSettings,
  deleteShopAllData,
  listShops,
} from "@/lib/shopStore";
export type { ShopData } from "@/lib/shopStore";
