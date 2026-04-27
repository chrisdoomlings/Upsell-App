export type VersionHistoryEntry = {
  version: string;
  releasedOn: string;
  title: string;
  summary: string;
  items: string[];
};

export const DEFAULT_VERSION_HISTORY: VersionHistoryEntry[] = [
  {
    version: "1.2",
    releasedOn: "2026-04-14",
    title: "Dashboard Updates And Rule Improvements",
    summary: "Added dashboard-facing release tracking and expanded campaign targeting across upsells and BXGY.",
    items: [
      "Upsell campaigns can now target multiple trigger products in a single rule.",
      "Buy X Get Y rules can now qualify on any non-gift product in the store.",
      "Added a Version History page in the dashboard.",
      "Added a latest update note in the dashboard header.",
    ],
  },
  {
    version: "1.1",
    releasedOn: "2026-04-13",
    title: "Bundle And Offer Improvements",
    summary: "Improved storefront bundle pricing display and expanded storefront discount behavior.",
    items: [
      "Bundle Offers now support stronger storefront price overrides.",
      "Collection and product feed sale-price rendering was improved for more theme layouts.",
      "Discount-code syncing for bundle offers remains active in cart and checkout.",
    ],
  },
];

export const DEFAULT_LATEST_VERSION_ENTRY = DEFAULT_VERSION_HISTORY[0];

function normalizeItems(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

function isValidReleaseDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function compareEntries(a: VersionHistoryEntry, b: VersionHistoryEntry) {
  const dateDiff = Date.parse(`${b.releasedOn}T00:00:00`) - Date.parse(`${a.releasedOn}T00:00:00`);
  if (!Number.isNaN(dateDiff) && dateDiff !== 0) return dateDiff;
  return b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: "base" });
}

export function normalizeVersionHistoryEntry(input: unknown): VersionHistoryEntry | null {
  if (!input || typeof input !== "object") return null;

  const value = input as Record<string, unknown>;
  const version = String(value.version ?? "").trim();
  const releasedOn = String(value.releasedOn ?? "").trim();
  const title = String(value.title ?? "").trim();
  const summary = String(value.summary ?? "").trim();
  const items = normalizeItems(value.items);

  if (!version || !releasedOn || !title || !summary || items.length === 0) return null;
  if (!isValidReleaseDate(releasedOn)) return null;

  return {
    version: version.slice(0, 32),
    releasedOn,
    title: title.slice(0, 120),
    summary: summary.slice(0, 280),
    items,
  };
}

export function normalizeVersionHistory(input: unknown): VersionHistoryEntry[] {
  if (!Array.isArray(input)) return [];

  const entries = input
    .map((entry) => normalizeVersionHistoryEntry(entry))
    .filter((entry): entry is VersionHistoryEntry => Boolean(entry));

  const deduped = Array.from(
    new Map(entries.map((entry) => [`${entry.version}__${entry.releasedOn}__${entry.title.toLowerCase()}`, entry])).values(),
  );

  return deduped.sort(compareEntries).slice(0, 25);
}

export function getVersionHistory(input?: unknown): VersionHistoryEntry[] {
  const normalized = normalizeVersionHistory(input);
  return normalized.length > 0 ? normalized : DEFAULT_VERSION_HISTORY;
}

export function getLatestVersionEntry(input?: unknown): VersionHistoryEntry {
  return getVersionHistory(input)[0] ?? DEFAULT_LATEST_VERSION_ENTRY;
}
