-- Bootstrap schema for the Upsell app.
-- Run this once in each Supabase database used by preview or production.

CREATE TABLE IF NOT EXISTS shops (
  shop text PRIMARY KEY,
  installed_at timestamptz,
  uninstalled_at timestamptz,
  plan text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shopify_sessions (
  id text PRIMARY KEY,
  shop text NOT NULL,
  state text,
  is_online boolean NOT NULL DEFAULT false,
  access_token text,
  scope text,
  expires timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopify_sessions_shop_idx
  ON shopify_sessions (shop);

CREATE TABLE IF NOT EXISTS analytics (
  shop text NOT NULL,
  date date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  revenue numeric(12, 2) NOT NULL DEFAULT 0,
  upsale_revenue numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  PRIMARY KEY (shop, date)
);

CREATE TABLE IF NOT EXISTS upsell_stats (
  shop text NOT NULL,
  rule_id text NOT NULL,
  date date NOT NULL,
  views integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  added integer NOT NULL DEFAULT 0,
  orders integer NOT NULL DEFAULT 0,
  units integer NOT NULL DEFAULT 0,
  revenue numeric(12, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (shop, rule_id, date)
);

CREATE TABLE IF NOT EXISTS bxgy_stats (
  shop text NOT NULL,
  rule_id text NOT NULL,
  date date NOT NULL,
  qualified integer NOT NULL DEFAULT 0,
  auto_added integer NOT NULL DEFAULT 0,
  PRIMARY KEY (shop, rule_id, date)
);

CREATE TABLE IF NOT EXISTS post_purchase_stats (
  shop text NOT NULL,
  offer_id text NOT NULL,
  date date NOT NULL,
  viewed integer NOT NULL DEFAULT 0,
  accepted integer NOT NULL DEFAULT 0,
  revenue numeric(12, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (shop, offer_id, date)
);

CREATE TABLE IF NOT EXISTS upsell_rules (
  id text PRIMARY KEY,
  shop text NOT NULL,
  trigger_product_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  trigger_product_titles text[] NOT NULL DEFAULT ARRAY[]::text[],
  upsell_products jsonb NOT NULL DEFAULT '[]'::jsonb,
  message text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS upsell_rules_shop_idx
  ON upsell_rules (shop);

CREATE TABLE IF NOT EXISTS bxgy_rules (
  id text PRIMARY KEY,
  shop text NOT NULL,
  name text NOT NULL DEFAULT 'Buy X Get Y',
  buy_products jsonb NOT NULL DEFAULT '[]'::jsonb,
  applies_to_any_product boolean NOT NULL DEFAULT false,
  gift_product jsonb,
  buy_quantity integer NOT NULL DEFAULT 1,
  gift_quantity integer NOT NULL DEFAULT 1,
  limit_one_gift_per_order boolean NOT NULL DEFAULT false,
  message text NOT NULL DEFAULT '',
  auto_add boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bxgy_rules_shop_idx
  ON bxgy_rules (shop);

CREATE TABLE IF NOT EXISTS post_purchase_offers (
  id text PRIMARY KEY,
  shop text NOT NULL,
  name text NOT NULL DEFAULT 'Post-purchase offer',
  offer_product jsonb,
  headline text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  cta_label text NOT NULL DEFAULT 'Add to order',
  discount_percent integer NOT NULL DEFAULT 10,
  priority integer NOT NULL DEFAULT 1,
  trigger_type text NOT NULL DEFAULT 'all_orders',
  trigger_product_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  minimum_subtotal numeric(12, 2) NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_purchase_offers_shop_idx
  ON post_purchase_offers (shop);

CREATE TABLE IF NOT EXISTS cart_quantity_rules (
  id text PRIMARY KEY,
  shop text NOT NULL,
  product_id text NOT NULL,
  product_title text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cart_quantity_rules_shop_idx
  ON cart_quantity_rules (shop);
