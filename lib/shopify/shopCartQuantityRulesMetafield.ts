import { getDb } from "@/lib/supabase/client";
import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";

export interface CartQuantityRule {
  id: string;
  productId: string;
  productTitle: string;
  quantity: number;
  enabled: boolean;
}

// Supabase is the source of truth. Metafield write keeps the storefront in sync.

export async function getShopCartQuantityRulesMetafield(
  shop: string,
  _accessToken: string,
): Promise<CartQuantityRule[]> {
  const db = getDb();
  const rows = await db`SELECT * FROM cart_quantity_rules WHERE shop = ${shop} ORDER BY created_at ASC`;
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      productId: String(r.product_id),
      productTitle: String(r.product_title || ""),
      quantity: Number(r.quantity) || 1,
      enabled: r.enabled !== false,
    };
  });
}

export async function setShopCartQuantityRulesMetafield(
  shop: string,
  accessToken: string,
  rules: CartQuantityRule[],
): Promise<void> {
  const db = getDb();

  // Upsert all rules
  for (const rule of rules) {
    await db`
      INSERT INTO cart_quantity_rules (id, shop, product_id, product_title, quantity, enabled, updated_at)
      VALUES (${rule.id}, ${shop}, ${rule.productId}, ${rule.productTitle}, ${rule.quantity}, ${rule.enabled !== false}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        product_id    = EXCLUDED.product_id,
        product_title = EXCLUDED.product_title,
        quantity      = EXCLUDED.quantity,
        enabled       = EXCLUDED.enabled,
        updated_at    = NOW()
    `;
  }

  // Sync to Shopify metafield for storefront reads
  try {
    const shopData = await shopifyAdminGraphql(shop, accessToken, `query GetShopId { shop { id } }`);
    const shopId = shopData?.data?.shop?.id as string | undefined;
    if (shopId) {
      await shopifyAdminGraphql(shop, accessToken, `
        mutation SetCartQuantityRules($ownerId: ID!, $value: String!) {
          metafieldsSet(metafields: [{
            ownerId: $ownerId namespace: "upsale" key: "cart_quantity_rules" type: "json" value: $value
          }]) { metafields { id } userErrors { field message } }
        }
      `, { ownerId: shopId, value: JSON.stringify({ rules }) });
    }
  } catch {
    // Metafield sync is best-effort
  }
}
