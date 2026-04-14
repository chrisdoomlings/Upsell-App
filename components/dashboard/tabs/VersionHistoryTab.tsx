"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { safeJson } from "../shared";
import type { VersionHistoryEntry } from "@/lib/versionHistory";

type VersionHistoryResponse = {
  entries?: VersionHistoryEntry[];
  latestEntry?: VersionHistoryEntry;
  error?: string;
};

type DraftRelease = {
  version: string;
  releasedOn: string;
  title: string;
  summary: string;
  itemsText: string;
};

const EMPTY_DRAFT: DraftRelease = {
  version: "",
  releasedOn: new Date().toISOString().slice(0, 10),
  title: "",
  summary: "",
  itemsText: "",
};

function formatReleaseDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function parseItems(itemsText: string) {
  return itemsText
    .split(/\r?\n/)
    .map((item) => item.replace(/^[\s*-]+/, "").trim())
    .filter(Boolean);
}

function publishLatestEntry(entry?: VersionHistoryEntry) {
  if (typeof window === "undefined" || !entry) return;
  window.dispatchEvent(new CustomEvent("version-history:latest-changed", { detail: entry }));
}

export default function VersionHistoryTab() {
  const [entries, setEntries] = useState<VersionHistoryEntry[]>([]);
  const [draft, setDraft] = useState<DraftRelease>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    const response = await fetch("/api/standalone/version-history", { cache: "no-store" });
    const data = await safeJson<VersionHistoryResponse>(response);

    if (!response.ok) {
      throw new Error(data?.error ?? `HTTP ${response.status}`);
    }

    const nextEntries = data?.entries ?? [];
    setEntries(nextEntries);
    publishLatestEntry(nextEntries[0]);
  }, []);

  useEffect(() => {
    loadEntries()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load version history."))
      .finally(() => setLoading(false));
  }, [loadEntries]);

  const latestEntry = entries[0] ?? null;
  const bulletCount = useMemo(() => parseItems(draft.itemsText).length, [draft.itemsText]);

  const handleDraftChange = (field: keyof DraftRelease, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setSuccess(null);
  };

  const handleAddRelease = async () => {
    const nextEntry: VersionHistoryEntry = {
      version: draft.version.trim(),
      releasedOn: draft.releasedOn.trim(),
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      items: parseItems(draft.itemsText),
    };

    if (!nextEntry.version || !nextEntry.releasedOn || !nextEntry.title || !nextEntry.summary || nextEntry.items.length === 0) {
      setError("Fill in version, date, title, summary, and at least one release bullet.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/standalone/version-history", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [nextEntry, ...entries],
        }),
      });

      const data = await safeJson<VersionHistoryResponse>(response);
      if (!response.ok) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }

      const nextEntries = data?.entries ?? [];
      setEntries(nextEntries);
      setDraft({
        ...EMPTY_DRAFT,
        releasedOn: new Date().toISOString().slice(0, 10),
      });
      setSuccess(`Saved version ${nextEntry.version}.`);
      publishLatestEntry(nextEntries[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the release.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRelease = async (entryToDelete: VersionHistoryEntry) => {
    const remaining = entries.filter((entry) => (
      !(entry.version === entryToDelete.version
        && entry.releasedOn === entryToDelete.releasedOn
        && entry.title === entryToDelete.title)
    ));

    if (remaining.length === 0) {
      setError("At least one version entry must remain.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/standalone/version-history", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: remaining }),
      });

      const data = await safeJson<VersionHistoryResponse>(response);
      if (!response.ok) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }

      const nextEntries = data?.entries ?? [];
      setEntries(nextEntries);
      setSuccess(`Removed version ${entryToDelete.version}.`);
      publishLatestEntry(nextEntries[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove the release.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading version history...</div>;
  }

  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Version History</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem", maxWidth: 780 }}>
          Add the next release from the admin and keep the dashboard release log up to date without editing code.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(280px, 0.9fr)", gap: "1rem", alignItems: "start", marginBottom: "1rem" }}>
        <section style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "1rem 1.1rem" }}>
          <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Latest release</p>
          {latestEntry ? (
            <>
              <p style={{ margin: "0.35rem 0 0", fontSize: "1.1rem", color: "#111827", fontWeight: 700 }}>
                {latestEntry.version} · {latestEntry.title}
              </p>
              <p style={{ margin: "0.2rem 0 0", color: "#6b7280", fontSize: "0.84rem" }}>
                Released {formatReleaseDate(latestEntry.releasedOn)}
              </p>
              <p style={{ margin: "0.75rem 0 0", color: "#374151", fontSize: "0.9rem", lineHeight: 1.6 }}>
                {latestEntry.summary}
              </p>
            </>
          ) : (
            <p style={{ margin: "0.35rem 0 0", color: "#6b7280", fontSize: "0.84rem" }}>No release history saved yet.</p>
          )}
        </section>

        <section style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "1rem 1.1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>New release note</p>
            <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{bulletCount} bullet{bulletCount === 1 ? "" : "s"}</span>
          </div>

          <div style={{ display: "grid", gap: "0.85rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
              <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.82rem", color: "#374151", fontWeight: 600 }}>
                Version
                <input
                  type="text"
                  value={draft.version}
                  onChange={(event) => handleDraftChange("version", event.target.value)}
                  placeholder="1.3"
                  style={{ border: "1px solid #d1d5db", borderRadius: "10px", padding: "0.7rem 0.8rem", fontSize: "0.9rem" }}
                />
              </label>
              <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.82rem", color: "#374151", fontWeight: 600 }}>
                Release date
                <input
                  type="date"
                  value={draft.releasedOn}
                  onChange={(event) => handleDraftChange("releasedOn", event.target.value)}
                  style={{ border: "1px solid #d1d5db", borderRadius: "10px", padding: "0.7rem 0.8rem", fontSize: "0.9rem" }}
                />
              </label>
            </div>

            <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.82rem", color: "#374151", fontWeight: 600 }}>
              Title
              <input
                type="text"
                value={draft.title}
                onChange={(event) => handleDraftChange("title", event.target.value)}
                placeholder="Checkout polish and reporting updates"
                style={{ border: "1px solid #d1d5db", borderRadius: "10px", padding: "0.7rem 0.8rem", fontSize: "0.9rem" }}
              />
            </label>

            <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.82rem", color: "#374151", fontWeight: 600 }}>
              Summary
              <textarea
                value={draft.summary}
                onChange={(event) => handleDraftChange("summary", event.target.value)}
                rows={3}
                placeholder="Summarize what shipped in one sentence."
                style={{ border: "1px solid #d1d5db", borderRadius: "10px", padding: "0.75rem 0.8rem", fontSize: "0.9rem", resize: "vertical", fontFamily: "inherit" }}
              />
            </label>

            <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.82rem", color: "#374151", fontWeight: 600 }}>
              Release bullets
              <textarea
                value={draft.itemsText}
                onChange={(event) => handleDraftChange("itemsText", event.target.value)}
                rows={6}
                placeholder={"One bullet per line\nAdded checkout targeting by collection\nImproved analytics table loading"}
                style={{ border: "1px solid #d1d5db", borderRadius: "10px", padding: "0.75rem 0.8rem", fontSize: "0.9rem", resize: "vertical", fontFamily: "inherit" }}
              />
            </label>
          </div>

          {error ? (
            <p style={{ margin: "0.85rem 0 0", color: "#b91c1c", fontSize: "0.84rem" }}>{error}</p>
          ) : null}
          {success ? (
            <p style={{ margin: "0.85rem 0 0", color: "#047857", fontSize: "0.84rem" }}>{success}</p>
          ) : null}

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={handleAddRelease}
              disabled={saving}
              style={{
                border: "none",
                borderRadius: "10px",
                padding: "0.72rem 1rem",
                background: saving ? "#c7d2fe" : "#4f46e5",
                color: "#fff",
                fontWeight: 700,
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Save release"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft({
                  ...EMPTY_DRAFT,
                  releasedOn: new Date().toISOString().slice(0, 10),
                });
                setError(null);
                setSuccess(null);
              }}
              disabled={saving}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "10px",
                padding: "0.72rem 1rem",
                background: "#fff",
                color: "#111827",
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              Clear form
            </button>
          </div>
        </section>
      </div>

      <div style={{ display: "grid", gap: "1rem" }}>
        {entries.map((entry) => (
          <section key={`${entry.version}-${entry.releasedOn}-${entry.title}`} style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "1.1rem 1.2rem" }}>
            <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontSize: "1rem", color: "#111827", fontWeight: 700 }}>
                  {entry.version} · {entry.title}
                </p>
                <p style={{ margin: "0.2rem 0 0", color: "#6b7280", fontSize: "0.82rem" }}>
                  Released {formatReleaseDate(entry.releasedOn)}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", padding: "0.28rem 0.6rem", borderRadius: "999px", background: "#eef2ff", color: "#4338ca", fontSize: "0.75rem", fontWeight: 700 }}>
                  {entry.version}
                </span>
                <button
                  type="button"
                  onClick={() => void handleDeleteRelease(entry)}
                  disabled={saving}
                  style={{
                    border: "1px solid #fecaca",
                    borderRadius: "999px",
                    padding: "0.28rem 0.75rem",
                    background: "#fff1f2",
                    color: "#b91c1c",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            </div>

            <p style={{ margin: "0.8rem 0 0", color: "#374151", fontSize: "0.9rem", lineHeight: 1.6 }}>
              {entry.summary}
            </p>

            <ul style={{ margin: "0.85rem 0 0", paddingLeft: "1.15rem", color: "#374151", fontSize: "0.88rem", lineHeight: 1.7 }}>
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
