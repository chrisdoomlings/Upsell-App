"use client";

import { LATEST_VERSION_ENTRY, VERSION_HISTORY } from "@/lib/versionHistory";

function formatReleaseDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function VersionHistoryTab() {
  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Version History</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem", maxWidth: 780 }}>
          A simple release log for recent dashboard and storefront updates. Update [lib/versionHistory.ts](/c:/shopify apps/Upsell-App/lib/versionHistory.ts:1) whenever a new feature ships.
        </p>
      </div>

      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "1rem 1.1rem", marginBottom: "1rem" }}>
        <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Latest release</p>
        <p style={{ margin: "0.35rem 0 0", fontSize: "1.1rem", color: "#111827", fontWeight: 700 }}>
          {LATEST_VERSION_ENTRY.version} · {LATEST_VERSION_ENTRY.title}
        </p>
        <p style={{ margin: "0.2rem 0 0", color: "#6b7280", fontSize: "0.84rem" }}>
          Released {formatReleaseDate(LATEST_VERSION_ENTRY.releasedOn)}
        </p>
      </div>

      <div style={{ display: "grid", gap: "1rem" }}>
        {VERSION_HISTORY.map((entry) => (
          <section key={entry.version} style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "1.1rem 1.2rem" }}>
            <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontSize: "1rem", color: "#111827", fontWeight: 700 }}>
                  {entry.version} · {entry.title}
                </p>
                <p style={{ margin: "0.2rem 0 0", color: "#6b7280", fontSize: "0.82rem" }}>
                  Released {formatReleaseDate(entry.releasedOn)}
                </p>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "0.28rem 0.6rem", borderRadius: "999px", background: "#eef2ff", color: "#4338ca", fontSize: "0.75rem", fontWeight: 700 }}>
                {entry.version}
              </span>
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
