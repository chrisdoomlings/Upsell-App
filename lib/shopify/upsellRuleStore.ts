import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";
import { getDb } from "@/lib/supabase/client";

export interface UpsellProduct {
  productId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
  discountPercent: number;
  badgeText?: string;
}

export interface UpsellRule {
  id: string;
  triggerProductId: string;
  triggerProductTitle: string;
  triggerProductIds: string[];
  triggerProductTitles: string[];
  upsellProducts: UpsellProduct[];
  message: string;
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Product hydration (still fetches live data from Shopify)
// ---------------------------------------------------------------------------

function productGidFromId(productId: string) {
  const id = String(productId || "").trim();
  if (!id) return null;
  if (id.startsWith("gid://shopify/Product/")) return id;
  return `gid://shopify/Product/${id.replace(/^gid:\/\/shopify\/Product\//, "")}`;
}

function productIdFromGid(gid: string | null | undefined) {
  if (!gid) return null;
  const m = String(gid).match(/gid:\/\/shopify\/Product\/(\d+)/);
  return m ? m[1] : null;
}

function summarizeTriggerTitles(triggerTitles: string[]) {
  const titles = triggerTitles.map((t) => String(t || "").trim()).filter(Boolean);
  if (!titles.length) return "";
  if (titles.length === 1) return titles[0];
  return `${titles[0]} +${titles.length - 1} more`;
}

type ProductSnapshot = {
  id: string;
  title: string;
  handle: string;
  image: string;
  price: string;
};

async function loadProductSnapshots(shop: string, accessToken: string, productIds: string[]) {
  const uniqueIds = Array.from(new Set(productIds.map((id) => String(id || "").trim()).filter(Boolean)));
  if (!uniqueIds.length) return new Map<string, ProductSnapshot>();

  const gids = uniqueIds.map(productGidFromId).filter((g): g is string => Boolean(g));
  if (!gids.length) return new Map<string, ProductSnapshot>();

  const data = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query UpsellRuleProducts($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            handle
            featuredImage { url }
            variants(first: 1) { nodes { price } }
          }
        }
      }
    `,
    { ids: gids },
  );

  const snapshots = new Map<string, ProductSnapshot>();
  const nodes = data?.data?.nodes ?? [];
  for (const node of nodes) {
    const productId = productIdFromGid(node?.id);
    if (!productId) continue;
    snapshots.set(productId, {
      id: productId,
      title: String(node?.title ?? ""),
      handle: String(node?.handle ?? ""),
      image: String(node?.featuredImage?.url ?? ""),
      price: String(node?.variants?.nodes?.[0]?.price ?? ""),
    });
  }
  return snapshots;
}

async function hydrateUpsellRule(shop: string, accessToken: string, rule: UpsellRule): Promise<UpsellRule> {
  const triggerProductIds = Array.from(
    new Set((rule.triggerProductIds ?? []).map((id) => String(id || "").trim()).filter(Boolean)),
  );
  const ids = [...triggerProductIds, ...rule.upsellProducts.map((p) => p.productId)];
  const snapshots = await loadProductSnapshots(shop, accessToken, ids);

  const hydratedTriggerTitles = triggerProductIds.map((id, index) => {
    const existing = Array.isArray(rule.triggerProductTitles) ? rule.triggerProductTitles[index] : "";
    return String(existing || snapshots.get(id)?.title || "").trim();
  }).filter(Boolean);

  const upsellProducts = rule.upsellProducts.map((p) => {
    const snap = snapshots.get(p.productId);
    return {
      ...p,
      title: p.title || snap?.title || "",
      image: p.image || snap?.image || "",
      price: p.price || snap?.price || "",
      handle: p.handle || snap?.handle || "",
    };
  });

  return {
    ...rule,
    triggerProductId: triggerProductIds[0] ?? "",
    triggerProductIds,
    triggerProductTitles: hydratedTriggerTitles,
    triggerProductTitle: summarizeTriggerTitles(hydratedTriggerTitles),
    upsellProducts,
  };
}

// ---------------------------------------------------------------------------
// Row → UpsellRule
// ---------------------------------------------------------------------------

function rowToRule(row: Record<string, unknown>): UpsellRule {
  const triggerProductIds = Array.isArray(row.trigger_product_ids)
    ? (row.trigger_product_ids as unknown[]).map(String)
    : [];
  const triggerProductTitles = Array.isArray(row.trigger_product_titles)
    ? (row.trigger_product_titles as unknown[]).map(String)
    : [];
  const upsellProducts = Array.isArray(row.upsell_products)
    ? (row.upsell_products as UpsellProduct[])
    : [];

  return {
    id: String(row.id),
    triggerProductId: triggerProductIds[0] ?? "",
    triggerProductTitle: "",
    triggerProductIds,
    triggerProductTitles,
    upsellProducts,
    message: String(row.message ?? ""),
    enabled: Boolean(row.enabled),
  };
}

// ---------------------------------------------------------------------------
// Public API — same signatures as before, API routes unchanged
// ---------------------------------------------------------------------------

export async function listUpsellRules(
  shop: string,
  accessToken: string,
  options?: { includeDisabled?: boolean },
): Promise<UpsellRule[]> {
  const db = getDb();
  const rows = options?.includeDisabled
    ? await db`SELECT * FROM upsell_rules WHERE shop = ${shop} ORDER BY created_at ASC`
    : await db`SELECT * FROM upsell_rules WHERE shop = ${shop} AND enabled = true ORDER BY created_at ASC`;

  const rules = rows.map((r) => rowToRule(r as Record<string, unknown>));
  return Promise.all(rules.map((rule) => hydrateUpsellRule(shop, accessToken, rule)));
}

export async function getUpsellRule(
  shop: string,
  accessToken: string,
  id: string,
  options?: { includeDisabled?: boolean },
): Promise<UpsellRule | null> {
  const h = String(id || "").trim();
  if (!h) return null;

  const db = getDb();
  const rows = options?.includeDisabled
    ? await db`SELECT * FROM upsell_rules WHERE shop = ${shop} AND id = ${h}`
    : await db`SELECT * FROM upsell_rules WHERE shop = ${shop} AND id = ${h} AND enabled = true`;

  if (!rows.length) return null;
  return hydrateUpsellRule(shop, accessToken, rowToRule(rows[0] as Record<string, unknown>));
}

export async function upsertUpsellRule(
  shop: string,
  accessToken: string,
  rule: Omit<UpsellRule, "id"> & { id?: string },
): Promise<{ id: string }> {
  const id = rule.id?.trim() || `upsell-${Date.now()}`;
  const triggerProductIds = Array.from(
    new Set(
      (Array.isArray(rule.triggerProductIds) ? rule.triggerProductIds : [rule.triggerProductId])
        .map((v) => String(v || "").trim())
        .filter(Boolean),
    ),
  );
  const triggerProductTitles = Array.from(
    new Set(
      (Array.isArray(rule.triggerProductTitles) ? rule.triggerProductTitles : [rule.triggerProductTitle])
        .map((v) => String(v || "").trim())
        .filter(Boolean),
    ),
  );

  if (!triggerProductIds.length) throw new Error("Missing trigger product id");

  const db = getDb();
  await db`
    INSERT INTO upsell_rules
      (id, shop, trigger_product_ids, trigger_product_titles, upsell_products, message, enabled, updated_at)
    VALUES (
      ${id},
      ${shop},
      ${triggerProductIds},
      ${triggerProductTitles},
      ${db.json(rule.upsellProducts ?? [])},
      ${rule.message || ""},
      ${rule.enabled !== false},
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      trigger_product_ids  = EXCLUDED.trigger_product_ids,
      trigger_product_titles = EXCLUDED.trigger_product_titles,
      upsell_products      = EXCLUDED.upsell_products,
      message              = EXCLUDED.message,
      enabled              = EXCLUDED.enabled,
      updated_at           = NOW()
  `;

  return { id };
}

export async function deleteUpsellRule(shop: string, _accessToken: string, id: string): Promise<void> {
  const db = getDb();
  await db`DELETE FROM upsell_rules WHERE shop = ${shop} AND id = ${id}`;
}
