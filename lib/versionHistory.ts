export type VersionHistoryEntry = {
  version: string;
  releasedOn: string;
  title: string;
  summary: string;
  items: string[];
};

export const VERSION_HISTORY: VersionHistoryEntry[] = [
  {
    version: "0.4.0",
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
    version: "0.3.0",
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

export const LATEST_VERSION_ENTRY = VERSION_HISTORY[0];
