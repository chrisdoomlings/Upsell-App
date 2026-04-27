"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FeatureHelpCard from "@/components/dashboard/FeatureHelpCard";
import { type Product, SearchableProductSelect } from "../products";
import type { UpsellProduct, UpsellRule, RuleStat } from "../types/upsell";

interface SuggestionDraft {
  productId: string;
  discountPercent: string;
  badgeText: string;
}

function ProductThumb({ p, url }: { p: UpsellProduct; url: string | null }) {
  const img = p.image
    ? <img src={p.image} alt={p.title} title={p.title} style={{ width: 32, height: 32, borderRadius: "6px", objectFit: "cover", border: "1px solid #e4e5e7" }} />
    : <div title={p.title} style={{ width: 32, height: 32, borderRadius: "6px", background: "#f1f1f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", color: "#6d7175" }}>{p.title.slice(0, 2)}</div>;
  if (!url) return img;
  return <a href={url} target="_blank" rel="noreferrer" title={p.title} style={{ display: "inline-flex" }}>{img}</a>;
}

function ProductCarousel({ products, storefrontUrlForProduct }: {
  products: UpsellProduct[];
  storefrontUrlForProduct: (productId?: string, fallbackHandle?: string) => string | null;
}) {
  const [offset, setOffset] = useState(0);
  const PAGE = 3;
  const canPrev = offset > 0;
  const canNext = offset + PAGE < products.length;
  const visible = products.slice(offset, offset + PAGE);

  const arrowBtn: React.CSSProperties = {
    width: 24, height: 24, border: "1px solid #d1d5db", borderRadius: "50%",
    background: "#fff", cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", fontSize: "0.75rem", color: "#374151", flexShrink: 0, padding: 0,
  };
  const disabledArrow: React.CSSProperties = { ...arrowBtn, opacity: 0.35, cursor: "default" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
      {products.length > PAGE && (
        <button
          style={canPrev ? arrowBtn : disabledArrow}
          disabled={!canPrev}
          onClick={() => setOffset((current) => Math.max(0, current - 1))}
        >
          {"<"}
        </button>
      )}
      {visible.map((product, index) => (
        <ProductThumb key={offset + index} p={product} url={storefrontUrlForProduct(product.productId, product.handle)} />
      ))}
      {products.length > PAGE && (
        <button
          style={canNext ? arrowBtn : disabledArrow}
          disabled={!canNext}
          onClick={() => setOffset((current) => Math.min(products.length - PAGE, current + 1))}
        >
          {">"}
        </button>
      )}
      <span style={{ fontSize: "0.78rem", color: "#6d7175", marginLeft: "0.1rem" }}>
        {products.length > PAGE
          ? `${offset + 1}-${Math.min(offset + PAGE, products.length)} of ${products.length}`
          : `${products.length} product${products.length !== 1 ? "s" : ""}`}
      </span>
    </div>
  );
}

export default function UpsellsTab({ storeUrl }: { storeUrl?: string }) {
  const router = useRouter();
  const [rules, setRules] = useState<UpsellRule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<RuleStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [triggerProductIds, setTriggerProductIds] = useState<string[]>([""]);
  const [campaignName, setCampaignName] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionDraft[]>([{ productId: "", discountPercent: "0", badgeText: "" }]);

  useEffect(() => {
    Promise.all([
      fetch("/api/standalone/upsells").then((response) => response.json()),
      fetch("/api/standalone/products").then((response) => response.json()),
      fetch("/api/standalone/stats").then((response) => response.json()),
    ]).then(([upsells, productResponse, statResponse]) => {
      setRules(upsells.rules ?? []);
      setProducts(productResponse.products ?? []);
      setStats(statResponse.rules ?? []);
    }).catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

  const resetForm = () => {
    setEditingRuleId(null);
    setTriggerProductIds([""]);
    setCampaignName("");
    setSuggestions([{ productId: "", discountPercent: "0", badgeText: "" }]);
    setError(null);
  };

  const addTriggerProduct = () => {
    if (triggerProductIds.length >= 10) return;
    setTriggerProductIds((current) => [...current, ""]);
  };

  const removeTriggerProduct = (index: number) => {
    setTriggerProductIds((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateTriggerProduct = (index: number, value: string) => {
    setTriggerProductIds((current) => current.map((entry, currentIndex) => (currentIndex === index ? value : entry)));
  };

  const addSuggestion = () => {
    if (suggestions.length >= 5) return;
    setSuggestions((current) => [...current, { productId: "", discountPercent: "0", badgeText: "" }]);
  };

  const removeSuggestion = (index: number) => setSuggestions((current) => current.filter((_, currentIndex) => currentIndex !== index));

  const updateSuggestion = (index: number, field: keyof SuggestionDraft, value: string) => {
    setSuggestions((current) => {
      const next = [...current];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const storefrontUrlForProduct = (productId?: string, fallbackHandle?: string) => {
    if (!storeUrl) return null;
    const liveHandle = products.find((product) => String(product.id) === String(productId || ""))?.handle;
    const handle = liveHandle || fallbackHandle || "";
    if (!handle) return null;
    return `${storeUrl.replace(/\/$/, "")}/products/${handle}`;
  };

  const selectedTriggerProductIds = Array.from(new Set(triggerProductIds.map((id) => String(id || "").trim()).filter(Boolean)));

  const renderTriggerSummary = (rule: UpsellRule) => {
    const triggerIds = rule.triggerProductIds?.length ? rule.triggerProductIds : [rule.triggerProductId];
    const triggerTitles = rule.triggerProductTitles?.length ? rule.triggerProductTitles : [rule.triggerProductTitle];
    const triggerProducts = triggerIds.map((triggerId, index) => {
      const product = products.find((entry) => String(entry.id) === triggerId);
      return {
        id: triggerId,
        title: triggerTitles[index] || product?.title || rule.triggerProductTitle,
        handle: product?.handle,
      };
    }).filter((entry) => entry.id && entry.title);

    if (!triggerProducts.length) return rule.triggerProductTitle || "Untitled trigger";

    if (triggerProducts.length === 1) {
      const triggerUrl = storefrontUrlForProduct(triggerProducts[0].id, triggerProducts[0].handle);
      if (!triggerUrl) return triggerProducts[0].title;
      return (
        <a
          href={triggerUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: "#111827", textDecoration: "none", fontWeight: 600 }}
        >
          {triggerProducts[0].title}
        </a>
      );
    }

    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
        {triggerProducts.map((trigger) => {
          const triggerUrl = storefrontUrlForProduct(trigger.id, trigger.handle);
          const chipStyle: React.CSSProperties = {
            display: "inline-flex",
            alignItems: "center",
            padding: "0.22rem 0.55rem",
            borderRadius: "999px",
            background: "#f3f4f6",
            color: "#111827",
            fontSize: "0.75rem",
            fontWeight: 600,
            textDecoration: "none",
          };
          return triggerUrl ? (
            <a key={trigger.id} href={triggerUrl} target="_blank" rel="noreferrer" style={chipStyle}>
              {trigger.title}
            </a>
          ) : (
            <span key={trigger.id} style={chipStyle}>
              {trigger.title}
            </span>
          );
        })}
      </div>
    );
  };

  const handleAdd = async () => {
    const validSuggestions = suggestions.filter((suggestion) => suggestion.productId && !selectedTriggerProductIds.includes(suggestion.productId));
    if (selectedTriggerProductIds.length === 0) { setError("Select at least one trigger product."); return; }
    if (!campaignName.trim()) { setError("Add a campaign name."); return; }
    if (validSuggestions.length === 0) { setError("Add at least one suggestion product that is different from every trigger product."); return; }
    setSaving(true);
    setError(null);

    const selectedTriggerProducts = selectedTriggerProductIds
      .map((triggerId) => products.find((product) => String(product.id) === triggerId))
      .filter((product): product is Product => Boolean(product));

    const upsellProducts: UpsellProduct[] = validSuggestions.map((suggestion) => {
      const product = products.find((entry) => String(entry.id) === suggestion.productId)!;
      return {
        productId: suggestion.productId,
        title: product?.title ?? "",
        image: product?.image?.src ?? "",
        price: product?.variants?.[0]?.price ?? "",
        handle: product?.handle ?? "",
        discountPercent: Number(suggestion.discountPercent) || 0,
        badgeText: suggestion.badgeText || "",
      };
    });

    const endpoint = editingRuleId ? `/api/standalone/upsells/${editingRuleId}` : "/api/standalone/upsells";
    const method = editingRuleId ? "PATCH" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingRuleId ?? undefined,
        triggerProductId: selectedTriggerProductIds[0],
        triggerProductTitle: selectedTriggerProducts[0]?.title ?? "",
        triggerProductIds: selectedTriggerProductIds,
        triggerProductTitles: selectedTriggerProducts.map((product) => product.title),
        upsellProducts,
        message: campaignName.trim(),
        enabled: true,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error);
      setSaving(false);
      return;
    }

    try {
      const [updated, refreshedStats] = await Promise.all([
        fetch("/api/standalone/upsells").then((res) => res.json()),
        fetch("/api/standalone/stats").then((res) => res.json()),
      ]);
      setRules(updated.rules ?? []);
      setStats(refreshedStats.rules ?? []);
      resetForm();
    } catch {
      setError("Saved, but failed to refresh. Please reload the page.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this upsell campaign? This cannot be undone.")) return;
    const response = await fetch(`/api/standalone/upsells/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Failed to delete campaign.");
      return;
    }
    setRules((current) => current.filter((entry) => entry.id !== id));
    setStats((current) => current.filter((entry) => entry.ruleId !== id));
  };

  const handleEdit = (rule: UpsellRule) => {
    setEditingRuleId(rule.id);
    setTriggerProductIds(rule.triggerProductIds?.length ? rule.triggerProductIds : [rule.triggerProductId]);
    setCampaignName(rule.message || "");
    setSuggestions(
      rule.upsellProducts.map((product) => ({
        productId: product.productId,
        discountPercent: String(product.discountPercent ?? 0),
        badgeText: product.badgeText || "",
      })),
    );
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDuplicate = (rule: UpsellRule) => {
    setEditingRuleId(null);
    setTriggerProductIds(rule.triggerProductIds?.length ? rule.triggerProductIds : [rule.triggerProductId]);
    setCampaignName(rule.message ? `${rule.message} copy` : "");
    setSuggestions(
      rule.upsellProducts.map((product) => ({
        productId: product.productId,
        discountPercent: String(product.discountPercent ?? 0),
        badgeText: product.badgeText || "",
      })),
    );
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleEnabled = async (rule: UpsellRule) => {
    const nextEnabled = rule.enabled === false ? true : false;
    const response = await fetch(`/api/standalone/upsells/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextEnabled }),
    });
    if (!response.ok) {
      setError("Failed to update campaign status.");
      return;
    }
    setRules((current) => current.map((entry) => (entry.id === rule.id ? { ...entry, enabled: nextEnabled } : entry)));
  };

  const inp: React.CSSProperties = { padding: "0.6rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", background: "#fff", color: "#1a1a1a" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" };

  const ruleStatRows = rules.map((rule) => {
    const stat = stats.find((entry) => entry.ruleId === rule.id);
    return {
      key: rule.id,
      campaign: rule.message || "Untitled campaign",
      triggerProductTitle: rule.triggerProductTitle || (rule.triggerProductTitles?.[0] ?? ""),
      suggestions: rule.upsellProducts,
      views: stat?.views ?? 0,
      clicks: stat?.clicks ?? 0,
      added: stat?.added ?? 0,
      ctr: stat?.ctr ?? "-",
      convRate: stat?.convRate ?? "-",
    };
  });

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading...</div>;

  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Upsells</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>Show product recommendations on product pages</p>
      </div>

      {error && <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", color: "#c0392b", fontSize: "0.875rem" }}>{error}</div>}

      <div style={{ background: "#fff", borderRadius: "10px", padding: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#1a1a1a", fontSize: "0.95rem" }}>{editingRuleId ? "Edit Upsell Campaign" : "New Upsell Rule"}</p>
          {editingRuleId && (
            <button
              onClick={resetForm}
              style={{ padding: "0.32rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", background: "#fff", color: "#374151", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
            >
              Cancel edit
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.35rem" }}>
              <label style={{ ...lbl, marginBottom: 0 }}>When customer views any of these products</label>
              {triggerProductIds.length < 10 && (
                <button onClick={addTriggerProduct} style={{ padding: "0.3rem 0.75rem", border: "1px solid #008060", borderRadius: "6px", background: "#fff", color: "#008060", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
                  + Add trigger
                </button>
              )}
            </div>
            <div style={{ display: "grid", gap: "0.55rem" }}>
              {triggerProductIds.map((triggerId, index) => (
                <div key={index} style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                  <SearchableProductSelect
                    products={products}
                    value={triggerId}
                    onChange={(value) => updateTriggerProduct(index, value)}
                    placeholder={`Search trigger product ${index + 1}`}
                    style={{ flex: 1 }}
                  />
                  {triggerProductIds.length > 1 && (
                    <button onClick={() => removeTriggerProduct(index)} style={{ border: "none", background: "none", color: "#c0392b", fontSize: "1rem", cursor: "pointer", flexShrink: 0, padding: "0.1rem 0.3rem" }}>×</button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>Campaign name</label>
            <input type="text" style={inp} value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Example: Playmat accessories" />
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <label style={{ ...lbl, margin: 0 }}>Suggest these products ({suggestions.length}/5)</label>
            {suggestions.length < 5 && (
              <button onClick={addSuggestion} style={{ padding: "0.3rem 0.75rem", border: "1px solid #008060", borderRadius: "6px", background: "#fff", color: "#008060", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
                + Add product
              </button>
            )}
          </div>

          {suggestions.map((suggestion, index) => {
            const picked = products.find((product) => String(product.id) === suggestion.productId);
            return (
              <div key={index} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.6rem", padding: "0.75rem", background: "#f9fafb", borderRadius: "8px", flexWrap: "wrap" }}>
                {picked?.image?.src && <img src={picked.image.src} alt={picked.title} style={{ width: 36, height: 36, borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />}
                <SearchableProductSelect
                  products={products.filter((product) => !selectedTriggerProductIds.includes(String(product.id)))}
                  value={suggestion.productId}
                  onChange={(value) => updateSuggestion(index, "productId", value)}
                  placeholder="Search suggested product"
                  style={{ flex: 2 }}
                />
                <div style={{ flex: "0 0 110px" }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    style={inp}
                    value={suggestion.discountPercent}
                    onChange={(event) => updateSuggestion(index, "discountPercent", event.target.value)}
                    placeholder="Discount %"
                    title="Discount %"
                  />
                </div>
                <div style={{ flex: "0 0 180px" }}>
                  <select
                    style={{ ...inp, width: "100%" }}
                    value={suggestion.badgeText}
                    onChange={(event) => updateSuggestion(index, "badgeText", event.target.value)}
                    title="Badge"
                  >
                    <option value="">No badge</option>
                    <option value="Best seller">Best seller</option>
                    <option value="Pairs well with">Pairs well with</option>
                    <option value="Staff pick">Staff pick</option>
                  </select>
                </div>
                <span style={{ fontSize: "0.75rem", color: "#6d7175", flexShrink: 0 }}>% off</span>
                {suggestions.length > 1 && (
                  <button onClick={() => removeSuggestion(index)} style={{ border: "none", background: "none", color: "#c0392b", fontSize: "1rem", cursor: "pointer", flexShrink: 0, padding: "0.1rem 0.3rem" }}>×</button>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={handleAdd} disabled={saving} style={{
          padding: "0.6rem 1.5rem", background: "#008060", color: "#fff", border: "none",
          borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}>{saving ? "Saving..." : editingRuleId ? "Update Campaign" : "Add Rule"}</button>
      </div>

      {rules.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6d7175", background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          No upsell rules yet. Add one above.
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e4e5e7" }}>
                {["Campaign", "When viewing", "Suggestions", "Status", "Actions", "Stats", ""].map((heading, index) => (
                  <th key={index} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 600, color: "#6d7175", textTransform: "uppercase" }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, index) => (
                <tr key={rule.id} style={{ borderBottom: index < rules.length - 1 ? "1px solid #f1f1f1" : "none" }}>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#111827", fontWeight: 600 }}>
                    {rule.message || "Untitled campaign"}
                  </td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", fontWeight: 500, color: "#1a1a1a" }}>
                    {renderTriggerSummary(rule)}
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <ProductCarousel products={rule.upsellProducts} storefrontUrlForProduct={storefrontUrlForProduct} />
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <button
                      onClick={() => void handleToggleEnabled(rule)}
                      style={{
                        padding: "0.28rem 0.72rem",
                        background: rule.enabled === false ? "#fff7ed" : "#ecfdf5",
                        color: rule.enabled === false ? "#c2410c" : "#047857",
                        border: `1px solid ${rule.enabled === false ? "#fed7aa" : "#a7f3d0"}`,
                        borderRadius: "999px",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {rule.enabled === false ? "Paused" : "Active"}
                    </button>
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button onClick={() => handleEdit(rule)} style={{
                        padding: "0.3rem 0.75rem", background: "#fff", color: "#374151",
                        border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                      }}>Edit</button>
                      <button onClick={() => handleDuplicate(rule)} style={{
                        padding: "0.3rem 0.75rem", background: "#fff", color: "#1d4ed8",
                        border: "1px solid #bfdbfe", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                      }}>Duplicate</button>
                    </div>
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <button onClick={() => router.push(`/dashboard/upsell/${rule.id}`)} style={{
                      padding: "0.3rem 0.75rem", background: "#f0faf7", color: "#008060",
                      border: "1px solid #b7dfce", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                    }}>View Stats</button>
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <button onClick={() => handleDelete(rule.id)} style={{
                      padding: "0.3rem 0.75rem", background: "#fff", color: "#c0392b",
                      border: "1px solid #ffd2d2", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                    }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden", marginTop: "1.5rem" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e4e5e7" }}>
          <p style={{ margin: 0, fontWeight: 600, color: "#1a1a1a", fontSize: "0.92rem" }}>Campaign Statistics</p>
          <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.8rem" }}>
            Performance per campaign. Detailed stats are available on individual stats pages.
          </p>
        </div>

        {ruleStatRows.length === 0 ? (
          <p style={{ padding: "2rem", textAlign: "center", color: "#6d7175", margin: 0 }}>
            No statistics yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e4e5e7" }}>
                {["Campaign", "Trigger Product", "Suggestions", "Views", "Clicks", "Added", "CTR", "Conv."].map((heading, index) => (
                  <th key={index} style={{ padding: "0.75rem 1rem", textAlign: index >= 3 ? "center" : "left", fontSize: "0.8rem", fontWeight: 600, color: "#6d7175", textTransform: "uppercase" }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ruleStatRows.map((row, index) => (
                <tr key={row.key} style={{ borderBottom: index < ruleStatRows.length - 1 ? "1px solid #f1f1f1" : "none" }}>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#1a1a1a", fontWeight: 600 }}>{row.campaign}</td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#1a1a1a", fontWeight: 500 }}>{row.triggerProductTitle}</td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <ProductCarousel products={row.suggestions} storefrontUrlForProduct={storefrontUrlForProduct} />
                  </td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center", fontSize: "0.875rem", color: "#1a1a1a" }}>{row.views}</td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center", fontSize: "0.875rem", color: "#1a1a1a" }}>{row.clicks}</td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center", fontSize: "0.875rem", color: "#1a1a1a" }}>{row.added}</td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                    <span style={{ background: "#f1f1f1", padding: "0.2rem 0.6rem", borderRadius: "20px", fontSize: "0.8rem" }}>{row.ctr}</span>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                    <span style={{ background: row.added > 0 ? "#e3f1df" : "#f1f1f1", color: row.added > 0 ? "#1a6b3c" : "#6d7175", padding: "0.2rem 0.6rem", borderRadius: "20px", fontSize: "0.8rem" }}>
                      {row.convRate}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <FeatureHelpCard
          intro="You can browse our app guide to understand upsells, read simple examples, and get setup help whenever you need it."
          sections={[
            {
              title: "Getting started",
              body: [
                "Choose one or more trigger products. These are the product pages where the recommendation can appear.",
                "Then add one or more suggestion products that you want to recommend as upsells.",
              ],
            },
            {
              title: "Field guide",
              body: [
                "Campaign name is your internal label. It helps your team recognize the upsell later.",
                "Suggested products are the items shown to the shopper. You can also add a discount percent or a short badge if needed.",
              ],
            },
            {
              title: "Examples",
              body: [
                "If the shopper views any core card game product, you can suggest sleeves, a playmat, or an expansion pack.",
                "A small discount or a short badge like Best seller can help the suggestion stand out.",
              ],
            },
            {
              title: "Common questions",
              body: [
                "Do not use the same product as both a trigger and a suggestion. The app expects them to be different products.",
                "After saving the rule, visit a few trigger product pages to confirm the recommendation appears where you expect.",
              ],
            },
          ]}
        />
      </div>
    </>
  );
}
