import { getDb } from "@/lib/supabase/client";

export interface BxgyProduct {
  productId: string;
  variantId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
}

export interface BxgyRule {
  id: string;
  name: string;
  buyProducts: BxgyProduct[];
  appliesToAnyProduct?: boolean;
  giftProduct: BxgyProduct | null;
  buyQuantity: number;
  giftQuantity: number;
  limitOneGiftPerOrder: boolean;
  message: string;
  autoAdd: boolean;
  priority: number;
  enabled: boolean;
}

function normalizePositiveInt(value: unknown, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function rowToRule(row: Record<string, unknown>): BxgyRule {
  return {
    id: String(row.id),
    name: String(row.name || "Buy X Get Y"),
    buyProducts: Array.isArray(row.buy_products) ? (row.buy_products as BxgyProduct[]) : [],
    appliesToAnyProduct: Boolean(row.applies_to_any_product),
    giftProduct: row.gift_product ? (row.gift_product as BxgyProduct) : null,
    buyQuantity: normalizePositiveInt(row.buy_quantity, 1),
    giftQuantity: normalizePositiveInt(row.gift_quantity, 1),
    limitOneGiftPerOrder: Boolean(row.limit_one_gift_per_order),
    message: String(row.message || ""),
    autoAdd: row.auto_add !== false,
    priority: normalizePositiveInt(row.priority, 1),
    enabled: row.enabled !== false,
  };
}

export async function listBxgyRules(shop: string, _accessToken: string): Promise<BxgyRule[]> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM bxgy_rules
    WHERE shop = ${shop}
    ORDER BY priority ASC, name ASC
  `;
  return rows
    .map((r) => rowToRule(r as Record<string, unknown>))
    .filter((r) => (r.appliesToAnyProduct || r.buyProducts.length > 0) && r.giftProduct?.variantId);
}

export async function upsertBxgyRule(
  shop: string,
  _accessToken: string,
  rule: Omit<BxgyRule, "id"> & { id?: string },
): Promise<{ id: string }> {
  if (!rule.appliesToAnyProduct && !rule.buyProducts.length) throw new Error("Select at least one Buy product");
  if (!rule.giftProduct?.variantId) throw new Error("Select a Gift product");

  const id = rule.id?.trim() || `bxgy-${Date.now()}`;
  const db = getDb();
  await db`
    INSERT INTO bxgy_rules
      (id, shop, name, buy_products, applies_to_any_product, gift_product,
       buy_quantity, gift_quantity, limit_one_gift_per_order, message, auto_add, priority, enabled, updated_at)
    VALUES (
      ${id}, ${shop},
      ${rule.name?.trim() || "Buy X Get Y"},
      ${db.json(JSON.parse(JSON.stringify(rule.buyProducts ?? [])))},
      ${rule.appliesToAnyProduct ?? false},
      ${db.json(JSON.parse(JSON.stringify(rule.giftProduct)))},
      ${normalizePositiveInt(rule.buyQuantity, 1)},
      ${normalizePositiveInt(rule.giftQuantity, 1)},
      ${rule.limitOneGiftPerOrder ?? false},
      ${rule.message?.trim() || ""},
      ${rule.autoAdd !== false},
      ${normalizePositiveInt(rule.priority, 1)},
      ${rule.enabled !== false},
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name                    = EXCLUDED.name,
      buy_products            = EXCLUDED.buy_products,
      applies_to_any_product  = EXCLUDED.applies_to_any_product,
      gift_product            = EXCLUDED.gift_product,
      buy_quantity            = EXCLUDED.buy_quantity,
      gift_quantity           = EXCLUDED.gift_quantity,
      limit_one_gift_per_order = EXCLUDED.limit_one_gift_per_order,
      message                 = EXCLUDED.message,
      auto_add                = EXCLUDED.auto_add,
      priority                = EXCLUDED.priority,
      enabled                 = EXCLUDED.enabled,
      updated_at              = NOW()
  `;
  return { id };
}

export async function deleteBxgyRule(shop: string, _accessToken: string, id: string): Promise<void> {
  const db = getDb();
  await db`DELETE FROM bxgy_rules WHERE shop = ${shop} AND id = ${id}`;
}
