import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";
import { getDb } from "@/lib/supabase/client";

export interface PostPurchaseProduct {
  productId: string;
  variantId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
}

export interface PostPurchaseOffer {
  id: string;
  name: string;
  offerProduct: PostPurchaseProduct | null;
  headline: string;
  body: string;
  ctaLabel: string;
  discountPercent: number;
  priority: number;
  triggerType: "all_orders" | "minimum_subtotal" | "contains_product";
  triggerProductIds: string[];
  minimumSubtotal: number;
  enabled: boolean;
}

function normalizePositiveInt(value: unknown, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePositiveNumber(value: unknown, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? fallback));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toGid(type: "Product" | "ProductVariant", value: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("gid://")) return trimmed;
  return `gid://shopify/${type}/${trimmed}`;
}

function fromGid(value: string | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/\/([^/]+)$/);
  return match?.[1] ?? raw;
}

type LiveVariantNode = {
  id?: string;
  price?: string;
  image?: { url?: string | null } | null;
  product?: {
    id?: string;
    title?: string;
    handle?: string;
    featuredImage?: { url?: string | null } | null;
  } | null;
} | null;

async function loadLiveVariants(shop: string, accessToken: string, offers: PostPurchaseOffer[]) {
  const ids = Array.from(
    new Set(
      offers
        .map((o) => toGid("ProductVariant", String(o.offerProduct?.variantId ?? "")))
        .filter(Boolean),
    ),
  );
  if (!ids.length) return new Map<string, LiveVariantNode>();

  const response = await shopifyAdminGraphql(shop, accessToken, `
    query PostPurchaseLiveVariants($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id price
          image { url }
          product { id title handle featuredImage { url } }
        }
      }
    }
  `, { ids });

  const nodes = Array.isArray(response?.data?.nodes) ? response.data.nodes as LiveVariantNode[] : [];
  const map = new Map<string, LiveVariantNode>();
  ids.forEach((id, i) => map.set(id, nodes[i] ?? null));
  return map;
}

function hydrateOfferProduct(
  offerProduct: PostPurchaseProduct | null,
  liveVariant: LiveVariantNode,
): PostPurchaseProduct | null {
  if (!offerProduct?.variantId || !liveVariant?.id || !liveVariant.product?.id) return null;
  return {
    productId: fromGid(liveVariant.product.id) || String(offerProduct.productId ?? "").trim(),
    variantId: fromGid(liveVariant.id) || String(offerProduct.variantId ?? "").trim(),
    title: String(liveVariant.product.title ?? offerProduct.title ?? "").trim(),
    image: String(liveVariant.image?.url ?? liveVariant.product?.featuredImage?.url ?? offerProduct.image ?? "").trim(),
    price: String(liveVariant.price ?? offerProduct.price ?? "").trim(),
    handle: String(liveVariant.product.handle ?? offerProduct.handle ?? "").trim(),
  };
}

function rowToOffer(row: Record<string, unknown>): PostPurchaseOffer {
  const triggerType = String(row.trigger_type || "all_orders");
  return {
    id: String(row.id),
    name: String(row.name || "Post-purchase offer"),
    offerProduct: row.offer_product ? (row.offer_product as PostPurchaseProduct) : null,
    headline: String(row.headline || ""),
    body: String(row.body || ""),
    ctaLabel: String(row.cta_label || "Add to order"),
    discountPercent: normalizePositiveInt(row.discount_percent, 10),
    priority: normalizePositiveInt(row.priority, 1),
    triggerType: (triggerType === "minimum_subtotal" || triggerType === "contains_product")
      ? triggerType
      : "all_orders",
    triggerProductIds: Array.isArray(row.trigger_product_ids)
      ? (row.trigger_product_ids as string[]).filter(Boolean)
      : [],
    minimumSubtotal: normalizePositiveNumber(row.minimum_subtotal, 0),
    enabled: row.enabled !== false,
  };
}

export async function listPostPurchaseOffers(shop: string, accessToken: string): Promise<PostPurchaseOffer[]> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM post_purchase_offers
    WHERE shop = ${shop} AND enabled = true
    ORDER BY priority ASC, name ASC
  `;

  const offers = rows
    .map((r) => rowToOffer(r as Record<string, unknown>))
    .filter((o) => o.offerProduct?.variantId);

  const liveVariants = await loadLiveVariants(shop, accessToken, offers);

  return offers
    .map((offer): PostPurchaseOffer | null => {
      const lv = liveVariants.get(toGid("ProductVariant", String(offer.offerProduct?.variantId ?? ""))) ?? null;
      const offerProduct = hydrateOfferProduct(offer.offerProduct, lv);
      return offerProduct ? { ...offer, offerProduct } : null;
    })
    .filter((o): o is PostPurchaseOffer => o !== null)
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}

export async function upsertPostPurchaseOffer(
  shop: string,
  _accessToken: string,
  offer: Omit<PostPurchaseOffer, "id"> & { id?: string },
): Promise<{ id: string }> {
  if (!offer.offerProduct?.variantId) throw new Error("Select an offer product");
  if (!offer.name?.trim()) throw new Error("Enter an offer name");

  const id = offer.id?.trim() || `post-purchase-${Date.now()}`;
  const db = getDb();
  await db`
    INSERT INTO post_purchase_offers
      (id, shop, name, offer_product, headline, body, cta_label, discount_percent,
       priority, trigger_type, trigger_product_ids, minimum_subtotal, enabled, updated_at)
    VALUES (
      ${id}, ${shop},
      ${offer.name.trim()},
      ${db.json(JSON.parse(JSON.stringify(offer.offerProduct)))},
      ${offer.headline?.trim() || ""},
      ${offer.body?.trim() || ""},
      ${offer.ctaLabel?.trim() || "Add to order"},
      ${normalizePositiveInt(offer.discountPercent, 10)},
      ${normalizePositiveInt(offer.priority, 1)},
      ${offer.triggerType || "all_orders"},
      ${(offer.triggerProductIds ?? []).filter(Boolean)},
      ${normalizePositiveNumber(offer.minimumSubtotal, 0)},
      ${offer.enabled !== false},
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name                = EXCLUDED.name,
      offer_product       = EXCLUDED.offer_product,
      headline            = EXCLUDED.headline,
      body                = EXCLUDED.body,
      cta_label           = EXCLUDED.cta_label,
      discount_percent    = EXCLUDED.discount_percent,
      priority            = EXCLUDED.priority,
      trigger_type        = EXCLUDED.trigger_type,
      trigger_product_ids = EXCLUDED.trigger_product_ids,
      minimum_subtotal    = EXCLUDED.minimum_subtotal,
      enabled             = EXCLUDED.enabled,
      updated_at          = NOW()
  `;
  return { id };
}

export async function deletePostPurchaseOffer(shop: string, _accessToken: string, id: string): Promise<void> {
  const db = getDb();
  await db`DELETE FROM post_purchase_offers WHERE shop = ${shop} AND id = ${id}`;
}
