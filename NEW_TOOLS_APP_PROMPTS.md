# New Tools App Prompts

This document preserves the removed tool features so they can be rebuilt in a separate Shopify app later. The current Upsell app should focus on upsells, Buy X Get Y, discount offers, and post-purchase offers.

## App Goal

Create a separate Shopify app for storefront utility tools:

- Cart Limits
- Custom Cursor
- Theme Scheduler
- Version History

Use the existing Upsell app as a reference, but keep this new app independent so the merchant dashboard stays focused and easier to use.

## Global Build Prompt

Use this prompt to start the new app:

```text
Build a new Shopify app called Storefront Tools. It should be separate from the existing Upsell app and should contain only utility features: Cart Limits, Custom Cursor, Theme Scheduler, and Version History.

Use a Next.js dashboard with Shopify authentication, a clean sidebar, and one tab per tool. Each tool should have its own API routes, storage layer, and storefront/runtime integration where needed. Keep the UI simple: each main tab should show a table/list and a create button, and editing or creating should happen in a detail view.

Reference the previous implementation from the Upsell app where useful, but do not include upsells, Buy X Get Y, discount offers, post-purchase, product analytics, or statistics unless required by one of the tools.
```

## Cart Limits Prompt

```text
Create a Cart Limits feature for the Storefront Tools Shopify app.

Requirements:
- Merchant can create rules that limit cart quantity for selected products or variants.
- Merchant can set minimum and maximum quantities.
- Merchant can enable or disable each rule.
- Dashboard main page should show only a rules table and a Create rule button.
- Rule create/edit should open in a separate detail view.
- Store the active rules in the app backend and sync them to a Shopify shop metafield for storefront use.
- Provide public API/runtime data for the storefront theme extension or app embed.
- Add clear empty, loading, error, save, and delete states.

Reference files from the old app:
- components/dashboard/tabs/CartLimitsTab.tsx
- app/api/standalone/cart-limits/route.ts
- app/api/public/cart-limits/route.ts
```

## Custom Cursor Prompt

```text
Create a Custom Cursor feature for the Storefront Tools Shopify app.

Requirements:
- Merchant can create cursor campaigns for the storefront.
- Campaigns can target pages or run globally.
- Campaigns can have start/end scheduling.
- Merchant can choose a preset cursor theme or provide a custom cursor image URL.
- Merchant can enable or disable campaigns.
- Dashboard main page should show only the campaigns table and a Create campaign button.
- Campaign create/edit should open in a separate detail view.
- Storefront app embed should read the active campaign and apply the cursor only on pointer/desktop devices.
- Add public API endpoint for active campaign lookup.

Reference files from the old app:
- components/dashboard/tabs/CustomCursorTab.tsx
- app/api/standalone/custom-cursor/route.ts
- app/api/public/custom-cursor/route.ts
```

## Theme Scheduler Prompt

```text
Create a Theme Scheduler feature for the Storefront Tools Shopify app.

Requirements:
- Merchant can see the current live theme and draft themes.
- Merchant can schedule a draft theme to publish at a future date/time.
- Date/time should be entered in the merchant-selected timezone and stored in UTC.
- Dashboard main page should show only scheduled launches and a Create schedule button.
- Schedule create/edit should open in a separate detail view.
- Add a background cron route that checks pending schedules and publishes themes when due.
- Include schedule status: pending, published, cancelled, failed.
- Add cancel/delete actions and clear failure messaging.

Reference files from the old app:
- components/dashboard/tabs/LaunchpadTab.tsx
- app/api/standalone/themes/route.ts
- app/api/standalone/launchpad/route.ts
- app/api/standalone/launchpad/run/route.ts
- app/api/cron/launchpad/route.ts
- lib/shopify/themeSwitcher.ts
```

## Version History Prompt

```text
Create a Version History feature for the Storefront Tools Shopify app.

Requirements:
- Merchant/admin can add release notes with version, release date, title, summary, and bullet items.
- Dashboard main page should show a release notes table and a Create release note button.
- Release note create/edit should open in a separate detail view.
- The app header may optionally show the latest version, but this should not be required for the other tools to work.
- Include edit, delete, and latest-release selection behavior if useful.
- Store data in the app backend.

Reference files from the old app:
- components/dashboard/tabs/VersionHistoryTab.tsx
- app/api/standalone/version-history/route.ts
- lib/versionHistory.ts
```

## Migration Notes

- Keep the new app scopes narrow. Theme Scheduler needs theme read/write scopes. Cart Limits may need product read scopes and metafield write access. Custom Cursor may only need app storage plus app embed access.
- Do not copy the old sidebar exactly. Use a focused navigation: Dashboard, Cart Limits, Custom Cursor, Theme Scheduler, Version History, Settings.
- Prefer list/detail views for every tool so the main pages stay uncluttered.
- Keep app embed setup instructions inside each tool detail/help section.
