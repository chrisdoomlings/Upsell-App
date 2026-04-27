"use client";

import { Page } from "@shopify/polaris";
import BundleOffersTab from "@/components/dashboard/tabs/BundleOffersTab";

export default function BundlesPage() {
  return (
    <Page title="Bundle Offers">
      <BundleOffersTab />
    </Page>
  );
}
