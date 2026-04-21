import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";
import type { BundleOffer, BundleOfferItem } from "@/lib/shopify/bundleOfferStore";

type BundleProductSnapshot = {
  id: string;
  title: string;
  handle: string;
  status: string;
  variantId: string;
  price: string;
  compareAtPrice: string | null;
};

function asProductGid(productId: string) {
  const value = String(productId || "").trim();
  if (!value) return "";
  return value.startsWith("gid://shopify/Product/")
    ? value
    : `gid://shopify/Product/${value.replace(/^gid:\/\/shopify\/Product\//, "")}`;
}

function asVariantGid(variantId: string) {
  const value = String(variantId || "").trim();
  if (!value) return "";
  return value.startsWith("gid://shopify/ProductVariant/")
    ? value
    : `gid://shopify/ProductVariant/${value.replace(/^gid:\/\/shopify\/ProductVariant\//, "")}`;
}

function fromGid(value: string | undefined | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/\/([^/]+)$/);
  return match?.[1] ?? raw;
}

function compactTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 255);
}

function normalizeMoneyString(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Compare-at price and discounted price must both be greater than zero.");
  }
  return amount.toFixed(2);
}

function buildBundleDescription(offer: Pick<BundleOffer, "name" | "items" | "discountedPrice" | "compareAtPrice">) {
  const lines = offer.items
    .map((item) => `- ${item.productTitle}${item.variantTitle ? ` (${item.variantTitle})` : ""} x${item.quantity}`)
    .join("\n");

  return [
    `${offer.name}`,
    "",
    "Included items:",
    lines || "- Bundle contents will be added here.",
    "",
    `Bundle price: $${Number(offer.discountedPrice).toFixed(2)}`,
    `Value price: $${Number(offer.compareAtPrice).toFixed(2)}`,
  ].join("\n");
}

function buildBundleTags(items: BundleOfferItem[]) {
  const componentCount = items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);
  return [
    "upsale-bundle",
    `upsale-bundle-items:${items.length}`,
    `upsale-bundle-qty:${componentCount}`,
  ];
}

function assertNoUserErrors(errors: Array<{ field?: string[]; message?: string }> | undefined, fallback: string) {
  if (!Array.isArray(errors) || errors.length === 0) return;
  throw new Error(errors[0]?.message ?? fallback);
}

async function updateVariantPricing(
  shop: string,
  accessToken: string,
  productId: string,
  variantId: string,
  discountedPrice: string,
  compareAtPrice: string,
) {
  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation UpdateBundleProductVariantPricing($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          product {
            id
          }
          productVariants {
            id
            price
            compareAtPrice
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      productId: asProductGid(productId),
      variants: [
        {
          id: asVariantGid(variantId),
          price: normalizeMoneyString(discountedPrice),
          compareAtPrice: normalizeMoneyString(compareAtPrice),
        },
      ],
    },
  );

  const payload = response?.data?.productVariantsBulkUpdate;
  assertNoUserErrors(payload?.userErrors, "Failed to update bundle product pricing.");
}

function readProductSnapshot(node: any): BundleProductSnapshot {
  const variant = node?.variants?.nodes?.[0];
  const id = fromGid(node?.id);
  const variantId = fromGid(variant?.id);

  if (!id || !variantId) {
    throw new Error("Bundle product is missing a default variant.");
  }

  return {
    id,
    title: String(node?.title ?? "").trim(),
    handle: String(node?.handle ?? "").trim(),
    status: String(node?.status ?? "").trim(),
    variantId,
    price: String(variant?.price ?? "").trim(),
    compareAtPrice: variant?.compareAtPrice == null ? null : String(variant.compareAtPrice).trim(),
  };
}

export async function createBundleProduct(
  shop: string,
  accessToken: string,
  input: {
    title: string;
    compareAtPrice: string;
    discountedPrice: string;
    items: BundleOfferItem[];
    offerName?: string;
  },
) {
  const title = compactTitle(input.title);
  if (!title) throw new Error("Enter a title for the generated bundle product.");

  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation CreateBundleProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 1) {
              nodes {
                id
                title
                price
                compareAtPrice
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      product: {
        title,
        status: "ACTIVE",
        descriptionHtml: buildBundleDescription({
          name: input.offerName?.trim() || title,
          items: input.items,
          discountedPrice: input.discountedPrice,
          compareAtPrice: input.compareAtPrice,
        }).replace(/\n/g, "<br />"),
        tags: buildBundleTags(input.items),
      },
    },
  );

  const payload = response?.data?.productCreate;
  assertNoUserErrors(payload?.userErrors, "Failed to create bundle product.");

  const product = readProductSnapshot(payload?.product);
  await updateVariantPricing(shop, accessToken, product.id, product.variantId, input.discountedPrice, input.compareAtPrice);

  return {
    ...product,
    title,
    price: normalizeMoneyString(input.discountedPrice),
    compareAtPrice: normalizeMoneyString(input.compareAtPrice),
  };
}

export async function getBundleProduct(shop: string, accessToken: string, productId: string) {
  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query GetBundleProduct($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          status
          variants(first: 1) {
            nodes {
              id
              title
              price
              compareAtPrice
            }
          }
        }
      }
    `,
    { id: asProductGid(productId) },
  );

  const node = response?.data?.product;
  if (!node) {
    throw new Error("Bundle product was not found in Shopify.");
  }

  return readProductSnapshot(node);
}

export async function syncManagedBundleProduct(shop: string, accessToken: string, offer: BundleOffer) {
  if (offer.productSource !== "generated" || !offer.productId) return null;

  const title = compactTitle(offer.storefrontTitle || offer.productTitle || offer.name);
  if (!title) throw new Error("Generated bundle products need a storefront title.");

  const current = await getBundleProduct(shop, accessToken, offer.productId);
  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation UpdateBundleProduct($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product {
            id
            title
            handle
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      product: {
        id: asProductGid(offer.productId),
        title,
        status: offer.enabled ? "ACTIVE" : "DRAFT",
        descriptionHtml: buildBundleDescription(offer).replace(/\n/g, "<br />"),
        tags: buildBundleTags(offer.items),
      },
    },
  );

  const payload = response?.data?.productUpdate;
  assertNoUserErrors(payload?.userErrors, "Failed to update generated bundle product.");

  await updateVariantPricing(shop, accessToken, offer.productId, current.variantId, offer.discountedPrice, offer.compareAtPrice);

  return {
    id: current.id,
    handle: String(payload?.product?.handle ?? current.handle).trim(),
    title,
  };
}
