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
        <button style={canPrev ? arrowBtn : disabledArrow} disabled={!canPrev} onClick={() => setOffset((c) => Math.max(0, c - 1))}>{"<"}</button>
      )}
      {visible.map((p, i) => (
        <ProductThumb key={offset + i} p={p} url={storefrontUrlForProduct(p.productId, p.handle)} />
      ))}
      {products.length > PAGE && (
        <button style={canNext ? arrowBtn : disabledArrow} disabled={!canNext} onClick={() => setOffset((c) => Math.min(products.length - PAGE, c + 1))}>{">"}</button>
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

  // Wizard state
  const [step, setStep] = useState<1 | 2>(1);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionDraft[]>([{ productId: "", discountPercent: "0", badgeText: "" }]);
  const [triggerProductIds, setTriggerProductIds] = useState<string[]>([""]);

  useEffect(() => {
    Promise.all([
      fetch("/api/standalone/upsells").then((r) => r.json()),
      fetch("/api/standalone/products").then((r) => r.json()),
      fetch("/api/standalone/stats").then((r) => r.json()),
    ]).then(([upsells, productResponse, statResponse]) => {
      setRules(upsells.rules ?? []);
      setProducts(productResponse.products ?? []);
      setStats(statResponse.rules ?? []);
    }).catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

  // ── Form helpers ─────────────────────────────────────────────────────────────

  const resetForm = () => {
    setStep(1);
    setEditingRuleId(null);
    setCampaignName("");
    setSuggestions([{ productId: "", discountPercent: "0", badgeText: "" }]);
    setTriggerProductIds([""]);
    setError(null);
  };

  // Step 1 → Step 2
  const handleNext = () => {
    if (!campaignName.trim()) { setError("Add a campaign name."); return; }
    const valid = suggestions.filter((s) => s.productId);
    if (!valid.length) { setError("Add at least one suggestion product."); return; }
    setError(null);
    setStep(2);
  };

  // Suggestions
  const addSuggestion = () => {
    if (suggestions.length >= 5) return;
    setSuggestions((c) => [...c, { productId: "", discountPercent: "0", badgeText: "" }]);
  };
  const removeSuggestion = (i: number) => setSuggestions((c) => c.filter((_, idx) => idx !== i));
  const updateSuggestion = (i: number, field: keyof SuggestionDraft, value: string) =>
    setSuggestions((c) => { const n = [...c]; n[i] = { ...n[i], [field]: value }; return n; });

  // Trigger products
  const addTriggerProduct = () => {
    if (triggerProductIds.length >= 10) return;
    setTriggerProductIds((c) => [...c, ""]);
  };
  const removeTriggerProduct = (i: number) => setTriggerProductIds((c) => c.filter((_, idx) => idx !== i));
  const updateTriggerProduct = (i: number, value: string) =>
    setTriggerProductIds((c) => c.map((id, idx) => (idx === i ? value : id)));

  const storefrontUrlForProduct = (productId?: string, fallbackHandle?: string) => {
    if (!storeUrl) return null;
    const handle = products.find((p) => String(p.id) === String(productId || ""))?.handle || fallbackHandle || "";
    return handle ? `${storeUrl.replace(/\/$/, "")}/products/${handle}` : null;
  };

  // ── Save ──────────────────────────────────────────────────────────────────────

  const handleSave = async (skipTriggers = false) => {
    const validSuggestions = suggestions.filter((s) => s.productId);
    const validTriggerIds = skipTriggers
      ? []
      : Array.from(new Set(triggerProductIds.map((id) => id.trim()).filter(Boolean)));
    const triggerTitles = validTriggerIds.map((id) => products.find((p) => String(p.id) === id)?.title ?? "");

    setSaving(true);
    setError(null);

    const upsellProducts: UpsellProduct[] = validSuggestions.map((s) => {
      const product = products.find((p) => String(p.id) === s.productId)!;
      return {
        productId: s.productId,
        title: product?.title ?? "",
        image: product?.image?.src ?? "",
        price: product?.variants?.[0]?.price ?? "",
        handle: product?.handle ?? "",
        discountPercent: Number(s.discountPercent) || 0,
        badgeText: s.badgeText || "",
      };
    });

    const endpoint = editingRuleId ? `/api/standalone/upsells/${editingRuleId}` : "/api/standalone/upsells";
    const method = editingRuleId ? "PATCH" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingRuleId ?? undefined,
        triggerProductId: validTriggerIds[0] ?? "",
        triggerProductTitle: triggerTitles[0] ?? "",
        triggerProductIds: validTriggerIds,
        triggerProductTitles: triggerTitles,
        upsellProducts,
        message: campaignName.trim(),
        enabled: true,
      }),
    });
    const data = await response.json();
    if (!response.ok) { setError(data.error); setSaving(false); return; }

    try {
      const [updated, refreshedStats] = await Promise.all([
        fetch("/api/standalone/upsells").then((r) => r.json()),
        fetch("/api/standalone/stats").then((r) => r.json()),
      ]);
      setRules(updated.rules ?? []);
      setStats(refreshedStats.rules ?? []);
      resetForm();
    } catch {
      setError("Saved, but failed to refresh. Please reload.");
    } finally {
      setSaving(false);
    }
  };

  // ── Rule actions ──────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this upsell campaign? This cannot be undone.")) return;
    const response = await fetch(`/api/standalone/upsells/${id}`, { method: "DELETE" });
    if (!response.ok) { setError("Failed to delete campaign."); return; }
    setRules((c) => c.filter((r) => r.id !== id));
    setStats((c) => c.filter((r) => r.ruleId !== id));
  };

  const handleEdit = (rule: UpsellRule) => {
    setStep(1);
    setEditingRuleId(rule.id);
    setCampaignName(rule.message || "");
    setSuggestions(
      rule.upsellProducts.map((p) => ({
        productId: p.productId,
        discountPercent: String(p.discountPercent ?? 0),
        badgeText: p.badgeText || "",
      })),
    );
    const existingTriggers = rule.triggerProductIds?.length ? rule.triggerProductIds : rule.triggerProductId ? [rule.triggerProductId] : [""];
    setTriggerProductIds(existingTriggers.length ? existingTriggers : [""]);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDuplicate = (rule: UpsellRule) => {
    setStep(1);
    setEditingRuleId(null);
    setCampaignName(rule.message ? `${rule.message} copy` : "");
    setSuggestions(
      rule.upsellProducts.map((p) => ({
        productId: p.productId,
        discountPercent: String(p.discountPercent ?? 0),
        badgeText: p.badgeText || "",
      })),
    );
    setTriggerProductIds([""]);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleEnabled = async (rule: UpsellRule) => {
    const nextEnabled = rule.enabled === false;
    const response = await fetch(`/api/standalone/upsells/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextEnabled }),
    });
    if (!response.ok) { setError("Failed to update campaign status."); return; }
    setRules((c) => c.map((r) => (r.id === rule.id ? { ...r, enabled: nextEnabled } : r)));
  };

  // ── Styles ────────────────────────────────────────────────────────────────────

  const inp: React.CSSProperties = {
    padding: "0.6rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "8px",
    fontSize: "0.875rem", background: "#fff", color: "#1a1a1a",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem",
  };

  const ruleStatRows = rules.map((rule) => {
    const stat = stats.find((s) => s.ruleId === rule.id);
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

  // ── Wizard card ───────────────────────────────────────────────────────────────

  const renderWizard = () => (
    <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: "1.5rem", overflow: "hidden" }}>

      {/* Progress header */}
      <div style={{ borderBottom: "1px solid #f1f1f1", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Step dots */}
          {([1, 2] as const).map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.75rem", fontWeight: 700,
                background: step === s ? "#008060" : step > s ? "#d1fae5" : "#f3f4f6",
                color: step === s ? "#fff" : step > s ? "#065f46" : "#9ca3af",
                border: step > s ? "1px solid #6ee7b7" : "none",
              }}>
                {step > s ? "✓" : s}
              </div>
              <span style={{ fontSize: "0.82rem", fontWeight: step === s ? 600 : 400, color: step === s ? "#111827" : "#9ca3af" }}>
                {s === 1 ? "Products to recommend" : "When to show it"}
              </span>
              {s === 1 && <span style={{ color: "#d1d5db", fontSize: "0.8rem" }}>›</span>}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.78rem", color: "#6d7175" }}>
            {editingRuleId ? "Editing campaign" : "New rule"}
          </span>
          {editingRuleId && (
            <button onClick={resetForm} style={{ padding: "0.28rem 0.65rem", border: "1px solid #d1d5db", borderRadius: "6px", background: "#fff", color: "#374151", fontSize: "0.76rem", fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Step body */}
      <div style={{ padding: "1.5rem" }}>
        {error && (
          <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.65rem 0.9rem", marginBottom: "1.1rem", color: "#c0392b", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        {step === 1 && (
          <>
            {/* Campaign name */}
            <div style={{ marginBottom: "1.25rem", maxWidth: 420 }}>
              <label style={lbl}>Campaign name</label>
              <input
                type="text"
                style={{ ...inp, width: "100%", boxSizing: "border-box" }}
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Playmat accessories"
                autoFocus
              />
            </div>

            {/* Suggestions */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ ...lbl, marginBottom: "0.1rem" }}>Products to recommend ({suggestions.length}/5)</label>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "#6d7175" }}>These are the items shown to shoppers as upsells.</p>
                </div>
                {suggestions.length < 5 && (
                  <button onClick={addSuggestion} style={{ padding: "0.3rem 0.75rem", border: "1px solid #008060", borderRadius: "6px", background: "#fff", color: "#008060", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                    + Add product
                  </button>
                )}
              </div>

              {suggestions.map((s, i) => {
                const picked = products.find((p) => String(p.id) === s.productId);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.55rem", padding: "0.75rem", background: "#f9fafb", borderRadius: "8px", flexWrap: "wrap" }}>
                    {picked?.image?.src && <img src={picked.image.src} alt={picked.title} style={{ width: 36, height: 36, borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />}
                    <SearchableProductSelect
                      products={products}
                      value={s.productId}
                      onChange={(v) => updateSuggestion(i, "productId", v)}
                      placeholder="Search product to recommend"
                      style={{ flex: 2 }}
                    />
                    <div style={{ flex: "0 0 110px" }}>
                      <input type="number" min="0" max="100" style={inp} value={s.discountPercent} onChange={(e) => updateSuggestion(i, "discountPercent", e.target.value)} placeholder="Discount %" title="Discount %" />
                    </div>
                    <div style={{ flex: "0 0 180px" }}>
                      <select style={{ ...inp, width: "100%" }} value={s.badgeText} onChange={(e) => updateSuggestion(i, "badgeText", e.target.value)} title="Badge">
                        <option value="">No badge</option>
                        <option value="Best seller">Best seller</option>
                        <option value="Pairs well with">Pairs well with</option>
                        <option value="Staff pick">Staff pick</option>
                      </select>
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "#6d7175", flexShrink: 0 }}>% off</span>
                    {suggestions.length > 1 && (
                      <button onClick={() => removeSuggestion(i)} style={{ border: "none", background: "none", color: "#c0392b", fontSize: "1rem", cursor: "pointer", flexShrink: 0, padding: "0.1rem 0.3rem" }}>×</button>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={handleNext} style={{ padding: "0.6rem 1.5rem", background: "#008060", color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
              Next →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ ...lbl, fontSize: "0.9rem" }}>When should this upsell appear?</label>
              <p style={{ margin: "0.1rem 0 0", fontSize: "0.8rem", color: "#6d7175" }}>
                Choose which product pages trigger this recommendation. You can add up to 10 products, or skip and add them later.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.65rem", maxWidth: 520 }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>Trigger products ({triggerProductIds.filter(Boolean).length} selected)</span>
              {triggerProductIds.length < 10 && (
                <button onClick={addTriggerProduct} style={{ padding: "0.28rem 0.65rem", border: "1px solid #008060", borderRadius: "6px", background: "#fff", color: "#008060", fontSize: "0.76rem", fontWeight: 600, cursor: "pointer" }}>
                  + Add product
                </button>
              )}
            </div>

            <div style={{ display: "grid", gap: "0.5rem", maxWidth: 520, marginBottom: "1.5rem" }}>
              {triggerProductIds.map((triggerId, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                  <SearchableProductSelect
                    products={products}
                    value={triggerId}
                    onChange={(v) => updateTriggerProduct(i, v)}
                    placeholder={`Search trigger product ${i + 1}`}
                    style={{ flex: 1 }}
                  />
                  {triggerProductIds.length > 1 && (
                    <button onClick={() => removeTriggerProduct(i)} style={{ border: "none", background: "none", color: "#c0392b", fontSize: "1rem", cursor: "pointer", flexShrink: 0, padding: "0.1rem 0.3rem" }}>×</button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <button onClick={() => { setError(null); setStep(1); }} style={{ padding: "0.6rem 1.1rem", background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
                ← Back
              </button>
              <button onClick={() => handleSave(false)} disabled={saving} style={{ padding: "0.6rem 1.5rem", background: "#008060", color: "#fff", border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : editingRuleId ? "Update rule" : "Save rule"}
              </button>
              {!editingRuleId && (
                <button onClick={() => handleSave(true)} disabled={saving} style={{ padding: "0.6rem 1rem", background: "none", color: "#6d7175", border: "none", fontSize: "0.82rem", cursor: "pointer", textDecoration: "underline" }}>
                  Skip for now
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ── Trigger chip renderer (table, read-only) ──────────────────────────────────

  const renderTriggerChips = (rule: UpsellRule) => {
    const ids = rule.triggerProductIds?.length ? rule.triggerProductIds : rule.triggerProductId ? [rule.triggerProductId] : [];
    const titles = rule.triggerProductTitles?.length ? rule.triggerProductTitles : rule.triggerProductTitle ? [rule.triggerProductTitle] : [];
    const entries = ids.map((id, i) => ({
      id,
      title: titles[i] || products.find((p) => String(p.id) === id)?.title || id,
      handle: products.find((p) => String(p.id) === id)?.handle,
    })).filter((e) => e.id && e.title);

    if (!entries.length) {
      return <span style={{ fontSize: "0.78rem", color: "#9ca3af", fontStyle: "italic" }}>None yet</span>;
    }

    const chip: React.CSSProperties = {
      display: "inline-flex", alignItems: "center", padding: "0.2rem 0.5rem",
      borderRadius: "999px", background: "#f3f4f6", color: "#111827",
      fontSize: "0.74rem", fontWeight: 600, textDecoration: "none",
    };

    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
        {entries.map((e) => {
          const url = storefrontUrlForProduct(e.id, e.handle);
          return url
            ? <a key={e.id} href={url} target="_blank" rel="noreferrer" style={chip}>{e.title}</a>
            : <span key={e.id} style={chip}>{e.title}</span>;
        })}
      </div>
    );
  };

  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Upsells</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>Show product recommendations on product pages</p>
      </div>

      {renderWizard()}

      {/* ── Rules table ── */}
      {rules.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6d7175", background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          No upsell rules yet. Create one above.
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e4e5e7" }}>
                {["Campaign", "Trigger products", "Suggestions", "Status", "Actions", "Stats", ""].map((h, i) => (
                  <th key={i} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 600, color: "#6d7175", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, index) => (
                <tr key={rule.id} style={{ borderBottom: index < rules.length - 1 ? "1px solid #f1f1f1" : "none" }}>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#111827", fontWeight: 600 }}>
                    {rule.message || "Untitled campaign"}
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    {renderTriggerChips(rule)}
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
                        borderRadius: "999px", fontSize: "0.76rem", fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      {rule.enabled === false ? "Paused" : "Active"}
                    </button>
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button onClick={() => handleEdit(rule)} style={{ padding: "0.3rem 0.75rem", background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer" }}>Edit</button>
                      <button onClick={() => handleDuplicate(rule)} style={{ padding: "0.3rem 0.75rem", background: "#fff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer" }}>Duplicate</button>
                    </div>
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <button onClick={() => router.push(`/dashboard/upsell/${rule.id}`)} style={{ padding: "0.3rem 0.75rem", background: "#f0faf7", color: "#008060", border: "1px solid #b7dfce", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer" }}>View Stats</button>
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <button onClick={() => handleDelete(rule.id)} style={{ padding: "0.3rem 0.75rem", background: "#fff", color: "#c0392b", border: "1px solid #ffd2d2", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer" }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Stats table ── */}
      <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden", marginTop: "1.5rem" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e4e5e7" }}>
          <p style={{ margin: 0, fontWeight: 600, color: "#1a1a1a", fontSize: "0.92rem" }}>Campaign Statistics</p>
          <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.8rem" }}>Performance per campaign. Detailed stats are on individual stats pages.</p>
        </div>
        {ruleStatRows.length === 0 ? (
          <p style={{ padding: "2rem", textAlign: "center", color: "#6d7175", margin: 0 }}>No statistics yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e4e5e7" }}>
                {["Campaign", "Trigger Product", "Suggestions", "Views", "Clicks", "Added", "CTR", "Conv."].map((h, i) => (
                  <th key={i} style={{ padding: "0.75rem 1rem", textAlign: i >= 3 ? "center" : "left", fontSize: "0.8rem", fontWeight: 600, color: "#6d7175", textTransform: "uppercase" }}>{h}</th>
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
                "Step 1 — Name the campaign and choose which products to recommend to shoppers.",
                "Step 2 — Pick the product pages where the recommendation will appear. You can also skip this and add triggers later by editing the rule.",
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
                "Create a rule recommending sleeves and a playmat, then add all card game products as triggers so shoppers see it on any of those pages.",
                "A small discount or a badge like Best seller can help the suggestion stand out.",
              ],
            },
            {
              title: "Common questions",
              body: [
                "Do not use the same product as both a trigger and a suggestion. The app expects them to be different.",
                "After saving, visit a trigger product page to confirm the recommendation appears where you expect.",
              ],
            },
          ]}
        />
      </div>
    </>
  );
}
