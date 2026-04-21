import { getDb } from "@/lib/supabase/client";

export interface ShopData {
  installedAt?: string;
  uninstalledAt?: string | null;
  plan?: string;
  settings?: Record<string, unknown>;
}

export async function saveShop(shop: string, data: ShopData): Promise<void> {
  const db = getDb();
  await db`
    INSERT INTO shops (shop, installed_at, uninstalled_at, plan, settings, updated_at)
    VALUES (
      ${shop},
      ${data.installedAt ?? null},
      ${data.uninstalledAt ?? null},
      ${data.plan ?? null},
      ${db.json(JSON.parse(JSON.stringify(data.settings ?? {})))},
      NOW()
    )
    ON CONFLICT (shop) DO UPDATE SET
      installed_at   = COALESCE(EXCLUDED.installed_at,   shops.installed_at),
      uninstalled_at = COALESCE(EXCLUDED.uninstalled_at, shops.uninstalled_at),
      plan           = COALESCE(EXCLUDED.plan,           shops.plan),
      updated_at     = NOW()
  `;
}

export async function getShop(shop: string): Promise<ShopData | null> {
  const db = getDb();
  const rows = await db`SELECT * FROM shops WHERE shop = ${shop}`;
  if (!rows.length) return null;
  const row = rows[0] as Record<string, unknown>;
  return {
    installedAt: row.installed_at ? String(row.installed_at) : undefined,
    uninstalledAt: row.uninstalled_at ? String(row.uninstalled_at) : null,
    plan: row.plan ? String(row.plan) : undefined,
    settings: (row.settings as Record<string, unknown>) ?? {},
  };
}

export async function markUninstalled(shop: string): Promise<void> {
  const db = getDb();
  await db`
    INSERT INTO shops (shop, uninstalled_at, updated_at)
    VALUES (${shop}, NOW(), NOW())
    ON CONFLICT (shop) DO UPDATE SET
      uninstalled_at = NOW(),
      updated_at     = NOW()
  `;
}

export async function updateShopSettings(shop: string, settings: Record<string, unknown>): Promise<void> {
  const db = getDb();
  await db`
    INSERT INTO shops (shop, settings, updated_at)
    VALUES (${shop}, ${db.json(JSON.parse(JSON.stringify(settings)))}, NOW())
    ON CONFLICT (shop) DO UPDATE SET
      settings   = EXCLUDED.settings,
      updated_at = NOW()
  `;
}

export async function deleteShopAllData(shop: string): Promise<void> {
  const db = getDb();
  await db`DELETE FROM analytics             WHERE shop = ${shop}`;
  await db`DELETE FROM upsell_stats          WHERE shop = ${shop}`;
  await db`DELETE FROM bxgy_stats            WHERE shop = ${shop}`;
  await db`DELETE FROM post_purchase_stats   WHERE shop = ${shop}`;
  await db`DELETE FROM upsell_rules          WHERE shop = ${shop}`;
  await db`DELETE FROM bxgy_rules            WHERE shop = ${shop}`;
  await db`DELETE FROM post_purchase_offers  WHERE shop = ${shop}`;
  await db`DELETE FROM cart_quantity_rules   WHERE shop = ${shop}`;
  await db`DELETE FROM shopify_sessions      WHERE shop = ${shop}`;
  await db`DELETE FROM shops                 WHERE shop = ${shop}`;
}

export async function listShops(): Promise<Array<{ shop: string; data: ShopData }>> {
  const db = getDb();
  const rows = await db`SELECT * FROM shops`;
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      shop: String(r.shop),
      data: {
        installedAt: r.installed_at ? String(r.installed_at) : undefined,
        uninstalledAt: r.uninstalled_at ? String(r.uninstalled_at) : null,
        plan: r.plan ? String(r.plan) : undefined,
        settings: (r.settings as Record<string, unknown>) ?? {},
      },
    };
  });
}
