export interface BundleOfferItem {
  productId: string;
  productTitle: string;
  variantId?: string;
  variantTitle?: string;
  quantity: number;
  image?: string;
}

export interface BundleOffer {
  id: string;
  name: string;
  offerType: "bundle" | "product";
  productSource: "existing" | "generated";
  productId: string;
  productTitle: string;
  storefrontHandle?: string;
  storefrontTitle: string;
  bundleLevel: "product" | "variant";
  items: BundleOfferItem[];
  code: string;
  compareAtPrice: string;
  discountedPrice: string;
  enabled: boolean;
  discountId?: string;
  createdAt: string;
  updatedAt: string;
}
