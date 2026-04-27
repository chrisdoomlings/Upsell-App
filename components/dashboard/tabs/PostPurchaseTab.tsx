"use client";

import { useEffect, useState } from "react";
import {
  BlockStack,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import FeatureHelpCard from "@/components/dashboard/FeatureHelpCard";
import PolarisProvider from "@/components/PolarisProvider";
import { safeJson, fmt } from "../shared";
import { type Product, PolarisProductAutocomplete, hasMeaningfulVariants, bxgyOptionLabel } from "../products";
import type { PostPurchaseProduct, PostPurchaseOffer, PostPurchaseSummary, PostPurchaseOfferStat } from "../types/post-purchase";

export default function PostPurchaseTab() { 
  const [isMobile, setIsMobile] = useState(false);
  const [offers, setOffers] = useState<PostPurchaseOffer[]>([]);
  const [summary, setSummary] = useState<PostPurchaseSummary | null>(null);
  const [offerStats, setOfferStats] = useState<PostPurchaseOfferStat[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Post-purchase offer");
  const [headline, setHeadline] = useState("One more thing before you go");
  const [body, setBody] = useState("Add this bonus item to the order you just placed without starting checkout again.");
  const [ctaLabel, setCtaLabel] = useState("Add to my order");
  const [discountPercent, setDiscountPercent] = useState("15");
  const [priority, setPriority] = useState("1");
  const [triggerType, setTriggerType] = useState<PostPurchaseOffer["triggerType"]>("all_orders");
  const [triggerProductIds, setTriggerProductIds] = useState<string[]>([""]);
  const [minimumSubtotal, setMinimumSubtotal] = useState("0");
  const [offerProductId, setOfferProductId] = useState("");
  const [offerVariantId, setOfferVariantId] = useState("");
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "detail">("list");
  const [query, setQuery] = useState("");
  const [updatingOfferId, setUpdatingOfferId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/standalone/post-purchase").then((r) => safeJson(r)),
      fetch("/api/standalone/post-purchase-stats").then((r) => safeJson(r)),
      fetch("/api/standalone/products").then((r) => safeJson(r)),
    ])
      .then(([offerData, statsData, productData]) => {
        setOffers(offerData?.offers ?? []);
        setSummary(statsData?.summary ?? null);
        setOfferStats(statsData?.offers ?? []);
        setProducts(productData?.products ?? []);
      })
      .catch(() => setError("Failed to load post-purchase offers."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const updateViewport = () => setIsMobile(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  const getSelectedVariantId = (productId: string, variantId?: string) => {
    const product = products.find((entry) => String(entry.id) === productId);
    if (!product?.variants?.length) return "";
    if (!hasMeaningfulVariants(product)) {
      return String(product.variants[0]?.id ?? "");
    }
    if (variantId && product.variants.some((entry) => String(entry.id) === variantId)) {
      return variantId;
    }
    return "";
  };

  const updateOfferProduct = (productId: string) => {
    setOfferProductId(productId);
    setOfferVariantId(getSelectedVariantId(productId));
  };

  const updateTriggerProduct = (index: number, productId: string) => {
    setTriggerProductIds((current) => current.map((entry, idx) => (idx === index ? productId : entry)));
  };

  const addTriggerProduct = () => {
    if (triggerProductIds.length >= 6) return;
    setTriggerProductIds((current) => [...current, ""]);
  };

  const removeTriggerProduct = (index: number) => {
    setTriggerProductIds((current) => current.filter((_, idx) => idx !== index));
  };

  const productToOffer = (productId: string, variantId: string): PostPurchaseProduct | null => {
    const product = products.find((entry) => String(entry.id) === productId);
    const resolvedVariantId = getSelectedVariantId(productId, variantId);
    const variant = product?.variants?.find((entry) => String(entry.id) === resolvedVariantId);
    if (!product || !variant) return null;
    return {
      productId: String(product.id),
      variantId: String(variant.id),
      title: bxgyOptionLabel(product, variant),
      image: product.image?.src ?? "",
      price: variant.price ?? "",
      handle: product.handle,
    };
  };

  const refreshData = async () => {
    const [offerData, statsData] = await Promise.all([
      fetch("/api/standalone/post-purchase").then((r) => safeJson(r)),
      fetch("/api/standalone/post-purchase-stats").then((r) => safeJson(r)),
    ]);
    setOffers(offerData?.offers ?? []);
    setSummary(statsData?.summary ?? null);
    setOfferStats(statsData?.offers ?? []);
  };

  const resetForm = () => {
    setEditingOfferId(null);
    setName("Post-purchase offer");
    setHeadline("One more thing before you go");
    setBody("Add this bonus item to the order you just placed without starting checkout again.");
    setCtaLabel("Add to my order");
    setDiscountPercent("15");
    setPriority("1");
    setTriggerType("all_orders");
    setTriggerProductIds([""]);
    setMinimumSubtotal("0");
    setOfferProductId("");
    setOfferVariantId("");
  };

  const openNewFlow = () => {
    resetForm();
    setError(null);
    setView("detail");
  };

  const backToList = () => {
    resetForm();
    setError(null);
    setView("list");
  };

  const startEditing = (offer: PostPurchaseOffer) => {
    setEditingOfferId(offer.id);
    setName(offer.name);
    setHeadline(offer.headline || "One more thing before you go");
    setBody(offer.body || "Add this bonus item to the order you just placed without starting checkout again.");
    setCtaLabel(offer.ctaLabel || "Add to my order");
    setDiscountPercent(String(offer.discountPercent || 15));
    setPriority(String(offer.priority || 1));
    setTriggerType(offer.triggerType || "all_orders");
    setTriggerProductIds(offer.triggerProductIds.length ? offer.triggerProductIds : [""]);
    setMinimumSubtotal(String(offer.minimumSubtotal || 0));
    setOfferProductId(offer.offerProduct?.productId ?? "");
    setOfferVariantId(offer.offerProduct?.variantId ?? "");
    setError(null);
    setView("detail");
  };

  const handleSave = async () => {
    const offerProduct = productToOffer(offerProductId, offerVariantId);
    const sanitizedTriggerProductIds = triggerProductIds.filter(Boolean);

    if (!name.trim()) {
      setError("Enter an offer name.");
      return;
    }
    if (!offerProduct) {
      setError("Select the product to offer after checkout.");
      return;
    }
    if (triggerType === "contains_product" && sanitizedTriggerProductIds.length === 0) {
      setError("Choose at least one trigger product for contains-product targeting.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/standalone/post-purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingOfferId,
        name,
        offerProduct,
        headline,
        body,
        ctaLabel,
        discountPercent,
        priority,
        triggerType,
        triggerProductIds: sanitizedTriggerProductIds,
        minimumSubtotal,
        enabled: selectedOffer?.enabled ?? true,
      }),
    });
    const data = await safeJson<{ error?: string }>(response);
    if (!response.ok) {
      setError(data?.error ?? "Failed to save post-purchase offer.");
      setSaving(false);
      return;
    }

    await refreshData();
    resetForm();
    setSaving(false);
    setView("list");
  };

  const updateExistingOffer = async (offer: PostPurchaseOffer, updates: Partial<PostPurchaseOffer>) => {
    setUpdatingOfferId(offer.id);
    setError(null);

    const response = await fetch("/api/standalone/post-purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...offer,
        ...updates,
      }),
    });
    const data = await safeJson<{ error?: string }>(response);
    if (!response.ok) {
      setError(data?.error ?? "Failed to update post-purchase flow.");
      setUpdatingOfferId(null);
      return;
    }

    await refreshData();
    setUpdatingOfferId(null);
  };

  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/standalone/post-purchase/${id}`, { method: "DELETE" });
    const data = await safeJson<{ error?: string }>(response);
    if (!response.ok) {
      setError(data?.error ?? "Failed to delete post-purchase offer.");
      return;
    }
    await refreshData();
    if (editingOfferId === id) {
      resetForm();
      setView("list");
    }
  };

  if (loading) {
    return (
      <PolarisProvider>
        <div style={{ padding: "2rem 0" }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
              <Text as="p" tone="subdued">Loading...</Text>
            </div>
          </Card>
        </div>
      </PolarisProvider>
    );
  }

  const selectedOfferProduct = products.find((product) => String(product.id) === offerProductId);
  const selectedProductLabel = selectedOfferProduct ? selectedOfferProduct.title : "Choose an offer product";
  const selectedTriggerCount = triggerProductIds.filter(Boolean).length;
  const triggerSummaryLabel =
    triggerType === "all_orders"
      ? "All eligible orders"
      : triggerType === "minimum_subtotal"
        ? `Subtotal over ${minimumSubtotal || "0"}`
        : `${selectedTriggerCount || 0} trigger product${selectedTriggerCount === 1 ? "" : "s"}`;
  const triggerOptions = [
    { label: "Every eligible order can see it", value: "all_orders" },
    { label: "Order subtotal reaches a threshold", value: "minimum_subtotal" },
    { label: "The order contains selected products", value: "contains_product" },
  ];
  const variantOptions = selectedOfferProduct?.variants?.map((variant) => ({
    label: variant.title,
    value: String(variant.id),
  })) ?? [];
  const selectedOffer = offers.find((offer) => offer.id === editingOfferId) ?? null;
  const selectedStat = offerStats.find((stat) => stat.offerId === editingOfferId) ?? null;
  const filteredOffers = (() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return offers;
    return offers.filter((offer) =>
      [
        offer.name,
        offer.id,
        offer.headline,
        offer.body,
        offer.offerProduct?.title,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  })();

  const flowMetrics = (offer: PostPurchaseOffer) => {
    const stat = offerStats.find((entry) => entry.offerId === offer.id);
    return {
      views: stat?.viewed ?? 0,
      conversion: stat?.conversionRate ?? "0%",
      revenue: fmt(stat?.revenue ?? 0, "USD"),
      revenuePerVisitor: stat?.viewed ? fmt((stat.revenue ?? 0) / stat.viewed, "USD") : "$0.00",
      accepted: stat?.accepted ?? 0,
    };
  };

  const triggerLabel = (offer: PostPurchaseOffer) => {
    if (offer.triggerType === "minimum_subtotal") return `Subtotal at least ${fmt(offer.minimumSubtotal, "USD")}`;
    if (offer.triggerType === "contains_product") {
      return `${offer.triggerProductIds.length} qualifying product${offer.triggerProductIds.length === 1 ? "" : "s"}`;
    }
    return "All eligible orders";
  };

  const detailHeading = editingOfferId ? "Flow details" : "New flow";

  return (
    <PolarisProvider>
      <>
        <div style={{ marginBottom: "1.25rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "#18336b" }}>Post Purchase</h1>
          <div style={{ display: "flex", gap: "1.35rem", borderBottom: "1px solid #e5e7eb", marginTop: "1.5rem" }}>
            {["Post-Purchase Widgets", "Post-Purchase Flows"].map((item) => {
              const active = item === "Post-Purchase Flows";
              return (
                <button
                  key={item}
                  type="button"
                  style={{
                    background: "transparent",
                    border: 0,
                    borderBottom: active ? "2px solid #3154ff" : "2px solid transparent",
                    color: active ? "#102d7a" : "#334e68",
                    cursor: "pointer",
                    fontSize: "0.95rem",
                    fontWeight: active ? 700 : 500,
                    padding: "0 0 0.8rem",
                  }}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: "1rem" }}>
            <Card>
              <Text as="p" tone="critical">{error}</Text>
            </Card>
          </div>
        )}

        {view === "list" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <Text as="h2" variant="headingLg">Post-Purchase Flows</Text>
              <Button variant="primary" onClick={openNewFlow}>New Flow</Button>
            </div>

            <div style={{ background: "#fff", border: "1px solid #d6deea", borderRadius: 6, overflow: "hidden", marginBottom: "1.5rem" }}>
              <div style={{ padding: "1.25rem", borderBottom: "1px solid #e5e7eb" }}>
                <TextField
                  label="Search flows"
                  labelHidden
                  value={query}
                  onChange={setQuery}
                  autoComplete="off"
                  placeholder="Search Flows"
                />
              </div>

              {filteredOffers.length === 0 ? (
                <p style={{ margin: 0, padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                  {offers.length === 0 ? "No post-purchase flows yet. Create your first flow to start." : "No flows match your search."}
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: 1050, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                        {["Active", "Name", "ID", "Offer product", "Trigger", "Total visitors", "Conversion", "Revenue", "Rev per visitor", ""].map((heading) => (
                          <th key={heading} style={{ padding: "0.9rem 1.15rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, color: "#334e68", textTransform: "uppercase" }}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOffers.map((offer, index) => {
                        const metrics = flowMetrics(offer);
                        return (
                          <tr key={offer.id} style={{ borderBottom: index < filteredOffers.length - 1 ? "1px solid #e5e7eb" : "none" }}>
                            <td style={{ padding: "0.85rem 1.15rem", verticalAlign: "middle" }}>
                              <button
                                type="button"
                                disabled={updatingOfferId === offer.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  updateExistingOffer(offer, { enabled: !offer.enabled });
                                }}
                                aria-label={offer.enabled ? "Disable flow" : "Enable flow"}
                                style={{
                                  width: 44,
                                  height: 24,
                                  border: 0,
                                  borderRadius: 999,
                                  background: offer.enabled ? "#3154e8" : "#cbd5df",
                                  cursor: updatingOfferId === offer.id ? "wait" : "pointer",
                                  padding: 3,
                                  transition: "background 120ms ease",
                                }}
                              >
                                <span style={{
                                  display: "block",
                                  width: 18,
                                  height: 18,
                                  borderRadius: "50%",
                                  background: "#fff",
                                  transform: offer.enabled ? "translateX(20px)" : "translateX(0)",
                                  transition: "transform 120ms ease",
                                }} />
                              </button>
                            </td>
                            <td style={{ padding: "0.85rem 1.15rem", verticalAlign: "middle" }}>
                              <button
                                type="button"
                                onClick={() => startEditing(offer)}
                                style={{ background: "transparent", border: 0, color: "#18336b", cursor: "pointer", font: "inherit", fontWeight: 600, padding: 0, textAlign: "left" }}
                              >
                                {offer.name}
                              </button>
                              <p style={{ color: "#6b7280", fontSize: "0.78rem", margin: "0.2rem 0 0", maxWidth: 260 }}>{offer.headline || offer.body}</p>
                            </td>
                            <td style={{ padding: "0.85rem 1.15rem" }}>
                              <span style={{ background: "#e5e9ee", borderRadius: 2, color: "#334e68", display: "inline-block", fontSize: "0.72rem", fontWeight: 700, padding: "0.25rem 0.35rem" }}>
                                {offer.id.slice(-5)}
                              </span>
                            </td>
                            <td style={{ padding: "0.85rem 1.15rem", color: "#334e68" }}>{offer.offerProduct?.title ?? "No product"}</td>
                            <td style={{ padding: "0.85rem 1.15rem", color: "#334e68" }}>{triggerLabel(offer)}</td>
                            <td style={{ padding: "0.85rem 1.15rem", color: "#18336b" }}>{metrics.views.toLocaleString()}</td>
                            <td style={{ padding: "0.85rem 1.15rem", color: "#18336b" }}>{metrics.conversion}</td>
                            <td style={{ padding: "0.85rem 1.15rem", color: "#18336b" }}>{metrics.revenue}</td>
                            <td style={{ padding: "0.85rem 1.15rem", color: "#18336b" }}>{metrics.revenuePerVisitor}</td>
                            <td style={{ padding: "0.85rem 1.15rem", textAlign: "right" }}>
                              <Button onClick={() => startEditing(offer)}>Details</Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ alignItems: "center", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", padding: "1rem 1.25rem", color: "#334e68", flexWrap: "wrap", gap: "1rem" }}>
                <span>Show 10 per page</span>
                <span>Page 1 of 1</span>
              </div>
            </div>

            {summary && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                {[
                  { label: "Active flows", value: summary.activeOffers, sub: "Currently enabled" },
                  { label: "Offer views", value: summary.totalViews, sub: "Rendered after checkout" },
                  { label: "Accepted", value: summary.totalAccepted, sub: "Customers who took the offer" },
                  { label: "Conversion", value: summary.conversionRate, sub: "Views to accepted" },
                  { label: "Revenue", value: fmt(summary.totalRevenue, "USD"), sub: "Tracked post-purchase sales" },
                ].map((card) => (
                  <div key={card.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: "1rem 1.15rem" }}>
                    <p style={{ margin: 0, fontSize: "0.74rem", color: "#6d7175", fontWeight: 700, textTransform: "uppercase" }}>{card.label}</p>
                    <p style={{ margin: "0.35rem 0 0.15rem", fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>{card.value}</p>
                    <p style={{ margin: 0, fontSize: "0.76rem", color: "#6d7175" }}>{card.sub}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <BlockStack gap="100">
                <Text as="h2" variant="headingLg">{detailHeading}</Text>
                {selectedOffer && <Text as="p" variant="bodySm" tone="subdued">Editing {selectedOffer.name}</Text>}
              </BlockStack>
              <InlineStack gap="200">
                <Button onClick={backToList}>Back to flows</Button>
                {editingOfferId && selectedOffer && (
                  <Button tone="critical" variant="secondary" onClick={() => handleDelete(selectedOffer.id)}>
                    Delete
                  </Button>
                )}
              </InlineStack>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              {[
                { label: "Status", value: selectedOffer?.enabled ? "Active" : editingOfferId ? "Inactive" : "Draft" },
                { label: "Discount", value: `${discountPercent || "0"}% off` },
                { label: "Trigger", value: triggerSummaryLabel },
                { label: "Offer product", value: selectedProductLabel },
                { label: "Conversion", value: selectedStat?.conversionRate ?? "0%" },
                { label: "Revenue", value: fmt(selectedStat?.revenue ?? 0, "USD") },
              ].map((card) => (
                <div key={card.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: "1rem 1.15rem" }}>
                  <p style={{ margin: 0, fontSize: "0.74rem", color: "#6d7175", fontWeight: 700, textTransform: "uppercase" }}>{card.label}</p>
                  <p style={{ margin: "0.35rem 0 0", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>{card.value}</p>
                </div>
              ))}
            </div>

            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingMd">Offer content</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Set the internal flow name, shopper-facing copy, and post-purchase action text.
                    </Text>
                  </BlockStack>
                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                    <TextField label="Flow name" value={name} onChange={setName} autoComplete="off" />
                    <TextField label="CTA label" value={ctaLabel} onChange={setCtaLabel} autoComplete="off" />
                  </InlineGrid>
                  <TextField label="Headline" value={headline} onChange={setHeadline} autoComplete="off" />
                  <TextField label="Offer body" value={body} onChange={setBody} multiline={6} autoComplete="off" />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingMd">Offer product</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Choose the item to show immediately after checkout.
                    </Text>
                  </BlockStack>
                  <PolarisProductAutocomplete
                    products={products}
                    value={offerProductId}
                    onChange={updateOfferProduct}
                    label="Offer product"
                    placeholder="Search product to offer"
                    helpText="This is the item the customer can add after completing checkout."
                  />
                  {hasMeaningfulVariants(selectedOfferProduct) && (
                    <Select label="Variant" options={variantOptions} value={offerVariantId} onChange={setOfferVariantId} />
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingMd">Rules and priority</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Control discount strength, sequencing, and which checkouts qualify.
                    </Text>
                  </BlockStack>
                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                    <TextField label="Discount percent" type="number" min={1} max={100} value={discountPercent} onChange={setDiscountPercent} autoComplete="off" />
                    <TextField label="Priority" type="number" min={1} value={priority} onChange={setPriority} autoComplete="off" />
                  </InlineGrid>
                  <Select label="Show offer when" options={triggerOptions} value={triggerType} onChange={(value) => setTriggerType(value as PostPurchaseOffer["triggerType"])} />
                  {triggerType === "minimum_subtotal" && (
                    <TextField label="Minimum subtotal" type="number" min={0} step={0.01} value={minimumSubtotal} onChange={setMinimumSubtotal} autoComplete="off" />
                  )}
                  {triggerType === "contains_product" && (
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="p" variant="bodyMd">Qualifying products</Text>
                        <Button onClick={addTriggerProduct}>Add product</Button>
                      </InlineStack>
                      {triggerProductIds.map((productId, index) => (
                        <div key={index} style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: isMobile ? "100%" : 0 }}>
                            <PolarisProductAutocomplete
                              products={products}
                              value={productId}
                              onChange={(value) => updateTriggerProduct(index, value)}
                              label={`Qualifying product ${index + 1}`}
                              placeholder="Search qualifying product"
                            />
                          </div>
                          {triggerProductIds.length > 1 && (
                            <Button tone="critical" variant="secondary" onClick={() => removeTriggerProduct(index)}>
                              Remove
                            </Button>
                          )}
                        </div>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingMd">Performance</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Flow-level results appear after the extension renders and customers accept offers.
                    </Text>
                  </BlockStack>
                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                    {[
                      { label: "Visitors", value: selectedStat?.viewed ?? 0 },
                      { label: "Accepted", value: selectedStat?.accepted ?? 0 },
                      { label: "Conversion", value: selectedStat?.conversionRate ?? "0%" },
                      { label: "Revenue", value: fmt(selectedStat?.revenue ?? 0, "USD") },
                    ].map((item) => (
                      <div key={item.label} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "0.8rem" }}>
                        <p style={{ margin: 0, color: "#6d7175", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase" }}>{item.label}</p>
                        <p style={{ margin: "0.25rem 0 0", color: "#0f172a", fontSize: "1rem", fontWeight: 700 }}>{item.value}</p>
                      </div>
                    ))}
                  </InlineGrid>
                </BlockStack>
              </Card>
            </InlineGrid>

            <div style={{ display: "flex", justifyContent: isMobile ? "stretch" : "flex-end", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.5rem" }}>
              <Button onClick={backToList}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>
                {editingOfferId ? "Update flow" : "Save flow"}
              </Button>
            </div>
          </>
        )}

        <FeatureHelpCard
          intro="You can browse our app guide to understand post-purchase offers, read simple examples, and get setup help whenever you need it."
          sections={[
            {
              title: "Getting started",
              body: [
                "Choose the product you want to show after checkout, then write a short headline and button label for the offer.",
                "You can show the offer to all orders, only after certain products are purchased, or only after a minimum subtotal is reached.",
              ],
            },
            {
              title: "Field guide",
              body: [
                "Offer product is the item the customer can add after checkout without starting over.",
                "Priority controls which offer should run first if more than one offer could apply at the same time.",
              ],
            },
            {
              title: "Examples",
              body: [
                "After a shopper buys a base game, you can offer an expansion or accessory with a small discount.",
                "You can also create a higher-value offer that appears only when the order subtotal is above a certain amount.",
              ],
            },
            {
              title: "Common questions",
              body: [
                "Keep the message short and clear so shoppers can understand the offer quickly after checkout.",
                "After saving the offer, test a checkout once to confirm the offer appears for the right kind of order.",
              ],
            },
          ]}
        />
      </>
    </PolarisProvider>
  );
}
