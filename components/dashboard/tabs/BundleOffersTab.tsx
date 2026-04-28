"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BlockStack,
  Button,
  Card,
  Checkbox,
  InlineGrid,
  InlineStack,
  Select,
  Text,
  TextField,
  Thumbnail,
} from "@shopify/polaris";
import FeatureHelpCard from "@/components/dashboard/FeatureHelpCard";
import { safeJson, fmt } from "../shared";
import { type Product, PolarisProductAutocomplete, hasMeaningfulVariants } from "../products";
import type { BundleOffer, BundleOfferItem } from "../types/bundle";

const EMPTY_ITEM_PICKER = ""; 

export default function BundleOffersTab() {
  const [offers, setOffers] = useState<BundleOffer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "detail">("list");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("Expansions Bundle");
  const [offerType, setOfferType] = useState<"bundle" | "product">("bundle");
  const [storefrontTitle, setStorefrontTitle] = useState("Standalone bundle product");
  const [bundleLevel, setBundleLevel] = useState<"product" | "variant">("product");
  const [productId, setProductId] = useState("");
  const [code, setCode] = useState("EXPANSIONS");
  const [compareAtPrice, setCompareAtPrice] = useState("95.00");
  const [discountedPrice, setDiscountedPrice] = useState("59.99");
  const [enabled, setEnabled] = useState(true);
  const [items, setItems] = useState<BundleOfferItem[]>([]);
  const [itemPickerProductId, setItemPickerProductId] = useState(EMPTY_ITEM_PICKER);

  const loadData = useCallback(async () => {
    const [bundleData, productData] = await Promise.all([
      fetch("/api/standalone/bundles").then((r) => safeJson<{ offers?: BundleOffer[]; error?: string }>(r)),
      fetch("/api/standalone/products").then((r) => safeJson<{ products?: Product[]; error?: string }>(r)),
    ]);

    setOffers(bundleData?.offers ?? []);
    setProducts(productData?.products ?? []);
  }, []);

  useEffect(() => {
    loadData()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load discount offers."))
      .finally(() => setLoading(false));
  }, [loadData]);

  const resetForm = () => {
    setEditingId(null);
    setName("Expansions Bundle");
    setOfferType("bundle");
    setStorefrontTitle("Standalone bundle product");
    setBundleLevel("product");
    setProductId("");
    setCode("EXPANSIONS");
    setCompareAtPrice("95.00");
    setDiscountedPrice("59.99");
    setEnabled(true);
    setItems([]);
    setItemPickerProductId(EMPTY_ITEM_PICKER);
  };

  const openNewOffer = () => {
    resetForm();
    setError(null);
    setSuccessMessage(null);
    setView("detail");
  };

  const backToList = () => {
    resetForm();
    setError(null);
    setView("list");
  };

  const selectedBundleProduct = products.find((product) => String(product.id) === productId) ?? null;
  const usedStandaloneProductIds = new Set(
    offers.filter((offer) => offer.id !== editingId).map((offer) => String(offer.productId)),
  );
  const selectableStandaloneProducts = products.filter(
    (product) => !usedStandaloneProductIds.has(String(product.id)),
  );
  const isBundleOffer = offerType === "bundle";

  const availableBundleItems = useMemo(() => {
    const selectedIds = new Set(items.map((item) => String(item.productId)));
    return products.filter((product) => !selectedIds.has(String(product.id)));
  }, [items, products]);

  const syncItemForLevel = useCallback(
    (item: BundleOfferItem): BundleOfferItem => {
      const product = products.find((entry) => String(entry.id) === String(item.productId));
      if (!product) return item;

      if (bundleLevel === "product") {
        return { ...item, variantId: undefined, variantTitle: undefined };
      }

      if (!hasMeaningfulVariants(product)) {
        const firstVariant = product.variants[0];
        return {
          ...item,
          variantId: firstVariant ? String(firstVariant.id) : undefined,
          variantTitle: firstVariant?.title,
        };
      }

      if (item.variantId && product.variants.some((variant) => String(variant.id) === String(item.variantId))) {
        const currentVariant = product.variants.find((variant) => String(variant.id) === String(item.variantId));
        return {
          ...item,
          variantTitle: currentVariant?.title,
        };
      }

      return {
        ...item,
        variantId: undefined,
        variantTitle: undefined,
      };
    },
    [bundleLevel, products],
  );

  useEffect(() => {
    setItems((current) => current.map(syncItemForLevel));
  }, [bundleLevel, syncItemForLevel]);

  const addBundleItem = () => {
    const product = products.find((entry) => String(entry.id) === itemPickerProductId);
    if (!product) return;

    const nextItem: BundleOfferItem = syncItemForLevel({
      productId: String(product.id),
      productTitle: product.title,
      quantity: 1,
      image: product.image?.src ?? undefined,
    });

    setItems((current) => [...current, nextItem]);
    setItemPickerProductId(EMPTY_ITEM_PICKER);
  };

  const updateItem = (productKey: string, updater: (item: BundleOfferItem) => BundleOfferItem) => {
    setItems((current) =>
      current.map((item) => (String(item.productId) === productKey ? updater(item) : item)),
    );
  };

  const removeItem = (productKey: string) => {
    setItems((current) => current.filter((item) => String(item.productId) !== productKey));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Enter an offer name.");
      setSuccessMessage(null);
      return;
    }
    if (!storefrontTitle.trim()) {
      setError("Enter the storefront title for the discounted storefront product.");
      setSuccessMessage(null);
      return;
    }
    if (!productId) {
      setError("Choose the storefront product to control.");
      setSuccessMessage(null);
      return;
    }
    if (!code.trim()) {
      setError("Enter the public discount code name.");
      setSuccessMessage(null);
      return;
    }
    if (isBundleOffer && items.length === 0) {
      setError("Add at least one product to the bundle.");
      setSuccessMessage(null);
      return;
    }

    const preparedItems = (isBundleOffer ? items : []).map((item) => {
      const product = products.find((entry) => String(entry.id) === String(item.productId));
      const variant = product?.variants.find((entry) => String(entry.id) === String(item.variantId));
      return {
        ...item,
        productTitle: product?.title ?? item.productTitle,
        image: product?.image?.src ?? item.image,
        variantTitle: variant?.title ?? item.variantTitle,
      };
    });

    if (
      bundleLevel === "variant" &&
      preparedItems.some((item) => {
        const product = products.find((entry) => String(entry.id) === String(item.productId));
        return hasMeaningfulVariants(product) && !item.variantId;
      })
    ) {
      setError("Choose a variant for each bundled product when variant level is selected.");
      setSuccessMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/standalone/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name,
          offerType,
          productId,
          productTitle: selectedBundleProduct?.title ?? "",
          storefrontHandle: selectedBundleProduct?.handle ?? "",
          storefrontTitle,
          bundleLevel,
          items: preparedItems,
          code,
          compareAtPrice,
          discountedPrice,
          enabled,
        }),
      });
      const data = await safeJson<{ offers?: BundleOffer[]; warning?: string; error?: string }>(response);
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      const wasEditing = !!editingId;
      setOffers(data?.offers ?? []);
      resetForm();
      if (data?.warning) {
        setError(`Offer ${wasEditing ? "updated" : "created"}, but discount sync failed: ${data.warning}`);
      } else {
        setSuccessMessage(wasEditing ? "Offer updated." : "Offer created.");
      }
      setView("list");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save discount offer.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (offerId: string) => {
    if (!confirm("Delete this discount offer? This cannot be undone.")) return;
    setDeletingId(offerId);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`/api/standalone/bundles/${offerId}`, { method: "DELETE" });
      const data = await safeJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      setOffers((current) => current.filter((offer) => offer.id !== offerId));
      if (editingId === offerId) {
        resetForm();
        setView("list");
      }
      setSuccessMessage("Offer deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete discount offer.");
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (offer: BundleOffer) => {
    setEditingId(offer.id);
    setName(offer.name);
    setOfferType(offer.offerType ?? "bundle");
    setStorefrontTitle(offer.storefrontTitle || offer.productTitle);
    setBundleLevel(offer.bundleLevel || "product");
    setProductId(offer.productId);
    setCode(offer.code);
    setCompareAtPrice(offer.compareAtPrice);
    setDiscountedPrice(offer.discountedPrice);
    setEnabled(offer.enabled);
    setItems(offer.items ?? []);
    setItemPickerProductId(EMPTY_ITEM_PICKER);
    setError(null);
    setSuccessMessage(null);
    setView("detail");
  };

  const copyOffer = (offer: BundleOffer) => {
    setEditingId(null);
    setName(`${offer.name} copy`);
    setOfferType(offer.offerType ?? "bundle");
    setStorefrontTitle(offer.storefrontTitle || offer.productTitle);
    setBundleLevel(offer.bundleLevel || "product");
    setProductId("");
    setCode(`${offer.code}-COPY`);
    setCompareAtPrice(offer.compareAtPrice);
    setDiscountedPrice(offer.discountedPrice);
    setEnabled(false);
    setItems(offer.items ?? []);
    setItemPickerProductId(EMPTY_ITEM_PICKER);
    setError(null);
    setSuccessMessage(null);
    setView("detail");
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading discount offers...</div>;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOffers = normalizedQuery
    ? offers.filter((offer) =>
        [
          offer.name,
          offer.productTitle,
          offer.storefrontTitle,
          offer.code,
          offer.offerType,
          offer.bundleLevel,
        ].some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery)),
      )
    : offers;

  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Discount Offers</h1>
        <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.84rem", maxWidth: 900 }}>
          Manage non-stackable native discount codes for both standalone discounted products and bundle products, while still showing the sale price across the storefront.
        </p>
      </div>

      {error && (
        <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", color: "#c0392b", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "0.75rem 1rem", color: "#166534", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {successMessage}
        </div>
      )}

      {view === "list" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, color: "#111827", fontSize: "1.45rem", fontWeight: 700 }}>Dashboard</h2>
            <button
              type="button"
              onClick={openNewOffer}
              style={{
                background: "#202223",
                border: "1px solid #000",
                borderRadius: 6,
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
                padding: "0.65rem 0.9rem",
              }}
            >
              Create bundle
            </button>
          </div>

          <div style={{ background: "#fff", border: "1px solid #dfe3e8", borderRadius: 8, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.35rem", padding: "1rem 1.25rem 0.75rem" }}>
              <TextField
                label="Search by bundle name"
                labelHidden
                value={query}
                onChange={setQuery}
                autoComplete="off"
                placeholder="Search by bundle name"
              />
              <Button onClick={() => setQuery("")} disabled={!query}>Clear</Button>
              <Button onClick={() => undefined}>Search</Button>
            </div>
            <div style={{ alignItems: "center", display: "flex", gap: "0.75rem", padding: "0.65rem 1.25rem 1rem" }}>
              <Checkbox label="" checked={false} onChange={() => undefined} />
              <span style={{ color: "#111827", fontSize: "0.88rem", fontWeight: 700 }}>
                Showing {filteredOffers.length} bundle{filteredOffers.length === 1 ? "" : "s"}
              </span>
            </div>

            {filteredOffers.length === 0 ? (
              <p style={{ borderTop: "1px solid #dfe3e8", margin: 0, padding: "1.5rem", color: "#6b7280" }}>
                {offers.length === 0 ? "No bundles yet. Create your first bundle to start." : "No bundles match your search."}
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse" }}>
                  <tbody>
                    {filteredOffers.map((offer) => (
                      <tr key={offer.id} style={{ borderTop: "1px solid #dfe3e8" }}>
                        <td style={{ padding: "0.95rem 1.25rem", width: 48, verticalAlign: "top" }}>
                          <Checkbox label="" checked={false} onChange={() => undefined} />
                        </td>
                        <td style={{ padding: "0.95rem 0.8rem", verticalAlign: "top" }}>
                          <button
                            type="button"
                            onClick={() => startEdit(offer)}
                            style={{ background: "transparent", border: 0, color: "#111827", cursor: "pointer", font: "inherit", fontWeight: 700, padding: 0, textAlign: "left" }}
                          >
                            {offer.name}
                          </button>
                          <div style={{ color: "#6b7280", fontSize: "0.78rem", marginTop: "0.15rem" }}>{offer.storefrontTitle || offer.productTitle}</div>
                        </td>
                        <td style={{ color: "#374151", fontSize: "0.84rem", padding: "0.95rem 0.8rem", verticalAlign: "top", whiteSpace: "nowrap" }}>
                          {offer.offerType === "product" ? "Standalone product" : `${offer.items.length} product${offer.items.length === 1 ? "" : "s"}`}
                        </td>
                        <td style={{ color: "#374151", fontSize: "0.84rem", padding: "0.95rem 0.8rem", verticalAlign: "top", whiteSpace: "nowrap" }}>
                          {offer.offerType === "product" ? "Standalone product" : offer.bundleLevel === "variant" ? "Variant level" : "Standalone product"}
                        </td>
                        <td style={{ padding: "0.95rem 0.8rem", textAlign: "right", verticalAlign: "top", whiteSpace: "nowrap" }}>
                          <button type="button" onClick={() => startEdit(offer)} style={{ background: "transparent", border: 0, color: "#2563eb", cursor: "pointer", fontWeight: 500, marginRight: "1rem" }}>Edit</button>
                          <button type="button" onClick={() => copyOffer(offer)} style={{ background: "transparent", border: 0, color: "#2563eb", cursor: "pointer", fontWeight: 500 }}>Copy</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {view === "detail" && (
        <>
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ alignItems: "center", display: "flex", gap: "1rem" }}>
              <button
                type="button"
                onClick={backToList}
                aria-label="Back to bundles"
                style={{
                  alignItems: "center",
                  background: "#fff",
                  border: "1px solid #c9cccf",
                  borderRadius: 4,
                  color: "#374151",
                  cursor: "pointer",
                  display: "inline-flex",
                  fontSize: "1.4rem",
                  height: 40,
                  justifyContent: "center",
                  lineHeight: 1,
                  width: 40,
                }}
              >
                {"<"}
              </button>
              <h2 style={{ margin: 0, color: "#111827", fontSize: "1.45rem", fontWeight: 700 }}>Bundle</h2>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                background: saving ? "#6b7280" : "#202223",
                border: "1px solid #000",
                borderRadius: 6,
                color: "#fff",
                cursor: saving ? "wait" : "pointer",
                fontWeight: 700,
                padding: "0.65rem 0.9rem",
              }}
            >
              {saving ? "Saving..." : "Save bundle"}
            </button>
          </div>

          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">General information</Text>
                <TextField label="Bundle name" value={name} onChange={setName} autoComplete="off" helpText="Bundle name won't be visible to your customers." />
                <TextField label="Title" value={storefrontTitle} onChange={setStorefrontTitle} autoComplete="off" helpText="This will be used as the title of the standalone product." />
                <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                  <Select
                    label="Offer type"
                    options={[
                      { label: "Bundle product", value: "bundle" },
                      { label: "Standalone discounted product", value: "product" },
                    ]}
                    value={offerType}
                    onChange={(value) => setOfferType(value === "product" ? "product" : "bundle")}
                  />
                  <PolarisProductAutocomplete
                    products={editingId ? products : selectableStandaloneProducts}
                    value={productId}
                    onChange={setProductId}
                    label="Storefront product"
                    placeholder="Search storefront product"
                  />
                </InlineGrid>
                <Checkbox label="Offer is active" checked={enabled} onChange={setEnabled} />
              </BlockStack>
            </Card>

            {isBundleOffer && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Bundle product level</Text>
                  <Select
                    label="Bundle level"
                    options={[
                      { label: "Product level", value: "product" },
                      { label: "Variant level", value: "variant" },
                    ]}
                    value={bundleLevel}
                    onChange={(value) => setBundleLevel(value === "variant" ? "variant" : "product")}
                  />
                </BlockStack>
              </Card>
            )}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Price</Text>
                <Text as="p" tone="subdued">Set the discount code and storefront sale pricing for this bundle.</Text>
                <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
                  <TextField label="Public discount code" value={code} onChange={(value) => setCode(value.toUpperCase())} autoComplete="off" />
                  <TextField label="Compare-at / value price" type="number" min={0} step={0.01} value={compareAtPrice} onChange={setCompareAtPrice} autoComplete="off" />
                  <TextField label="Discounted storefront price" type="number" min={0} step={0.01} value={discountedPrice} onChange={setDiscountedPrice} autoComplete="off" />
                </InlineGrid>
              </BlockStack>
            </Card>

            {isBundleOffer && (
              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">Products in the bundle</Text>
                    <Text as="p" tone="subdued">
                      Select the products you want to offer in the bundle. Shopify allows up to 30 products per standalone product bundle.
                    </Text>
                  </BlockStack>

                  <InlineStack gap="300" blockAlign="end" wrap>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <PolarisProductAutocomplete
                        products={availableBundleItems}
                        value={itemPickerProductId}
                        onChange={setItemPickerProductId}
                        label="Add product"
                        placeholder="Search product to include"
                      />
                    </div>
                    <Button onClick={addBundleItem} disabled={!itemPickerProductId || items.length >= 30}>
                      Add product
                    </Button>
                  </InlineStack>

                  <div style={{ alignItems: "center", display: "flex", gap: "0.75rem", paddingTop: "0.25rem" }}>
                    <Checkbox label="" checked={false} onChange={() => undefined} />
                    <span style={{ color: "#111827", fontSize: "0.88rem", fontWeight: 700 }}>
                      Showing {items.length} product{items.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <div style={{ border: "1px dashed #d1d5db", borderRadius: 8, padding: "1rem", color: "#6b7280" }}>
                      No bundled products yet. Add your first product above.
                    </div>
                  ) : (
                    <div style={{ borderTop: "1px solid #e5e7eb" }}>
                      {items.map((item) => {
                        const product = products.find((entry) => String(entry.id) === String(item.productId));
                        const variantOptions = [
                          { label: "Select variant", value: "" },
                          ...((product?.variants ?? []).map((variant) => ({ label: variant.title, value: String(variant.id) }))),
                        ];
                        const needsVariant = bundleLevel === "variant" && hasMeaningfulVariants(product);

                        return (
                          <div key={item.productId} style={{ alignItems: "center", borderBottom: "1px solid #e5e7eb", display: "grid", gap: "1rem", gridTemplateColumns: "auto minmax(180px, 1fr) minmax(100px, 150px) auto", padding: "0.95rem 0" }}>
                            <Checkbox label="" checked={false} onChange={() => undefined} />
                            <InlineStack gap="300" blockAlign="center">
                              {item.image ? <Thumbnail source={item.image} alt={item.productTitle} size="small" /> : null}
                              <BlockStack gap="050">
                                <Text as="p" variant="bodyMd" fontWeight="semibold">{item.productTitle}</Text>
                                <Text as="p" variant="bodySm" tone="subdued">
                                  {needsVariant ? "Choose a variant." : "Set bundle quantity."}
                                </Text>
                              </BlockStack>
                            </InlineStack>
                            {needsVariant ? (
                              <Select
                                label="Variant"
                                options={variantOptions}
                                value={item.variantId ?? ""}
                                onChange={(value) => {
                                  const selectedVariant = product?.variants.find((variant) => String(variant.id) === value);
                                  updateItem(String(item.productId), (current) => ({
                                    ...current,
                                    variantId: value || undefined,
                                    variantTitle: selectedVariant?.title,
                                  }));
                                }}
                              />
                            ) : (
                              <span style={{ color: "#9ca3af", fontSize: "0.82rem" }}>1 variant(s)</span>
                            )}
                            <TextField
                              label="Quantity"
                              type="number"
                              min={1}
                              value={String(item.quantity || 1)}
                              onChange={(value) => {
                                updateItem(String(item.productId), (current) => ({
                                  ...current,
                                  quantity: Math.max(1, Number.parseInt(value || "1", 10) || 1),
                                }));
                              }}
                              autoComplete="off"
                            />
                            <Button tone="critical" variant="tertiary" onClick={() => removeItem(String(item.productId))}>
                              Remove
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </BlockStack>
              </Card>
            )}

            <InlineStack align="space-between" blockAlign="center">
              <Text as="p" tone="subdued">
                Enable the `Bundle offers` app embed in your theme so sale price preview and cart code behavior can run on the storefront.
              </Text>
              <InlineStack gap="300">
                <Button onClick={backToList} disabled={saving}>Cancel</Button>
                {editingId && (
                  <Button tone="critical" variant="secondary" onClick={() => void handleDelete(editingId)} loading={deletingId === editingId} disabled={deletingId === editingId}>
                    Delete
                  </Button>
                )}
              </InlineStack>
            </InlineStack>
          </BlockStack>

          <div style={{ marginTop: "1.5rem" }}>
        <FeatureHelpCard
          intro="You can browse our app guide to understand discount offers, read simple examples, and get setup help whenever you need it."
          sections={[
            {
              title: "Getting started",
              body: [
                "Choose the storefront product first, then decide whether this offer is a bundle product or a standalone discounted product.",
                "If the offer is a bundle, add the products you want inside it and set a quantity for each one.",
              ],
            },
            {
              title: "Field guide",
              body: [
                "Offer name is for your team. Title is the shopper-facing title for the discounted storefront product.",
                "Bundle product is best when you want to track included items. Standalone discounted product is best when you only need a protected native code for one product.",
              ],
            },
            {
              title: "Examples",
              body: [
                "You can create an Expansions Bundle that includes several different products with quantity 1 each.",
                "You can also create a standalone discounted product offer where no bundle contents are tracked, but the product still gets its own non-stackable code.",
              ],
            },
            {
              title: "Common questions",
              body: [
                "The storefront product is the item that carries the sale price display and discount code behavior.",
                "After saving the offer, visit the storefront product page once to make sure the price preview and cart code flow look correct.",
              ],
            },
          ]}
        />
          </div>
        </>
      )}
    </>
  );
}
