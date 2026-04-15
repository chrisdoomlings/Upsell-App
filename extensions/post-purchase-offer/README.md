# Post-Purchase Offer Extension

This folder is reserved for the Shopify post-purchase checkout extension used by Doomlings.

Current status:
- The app dashboard, offer storage, and offer statistics are implemented in the main app.
- The checkout extension source is present in `src/index.js` and calls the app's post-purchase endpoints.
- A live store still needs Shopify post-purchase access approval before the extension can run there.

Recommended next step when validating the live checkout:
1. Confirm the active Shopify app config matches the deployed `SHOPIFY_API_KEY`.
2. Test on a development store with the Shopify post-purchase browser extension.
3. Request Shopify access before enabling on a live store.
