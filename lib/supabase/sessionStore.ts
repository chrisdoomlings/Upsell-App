import { Session } from "@shopify/shopify-api";
import { getDb } from "@/lib/supabase/client";

function rowToSession(row: Record<string, unknown>): Session {
  const pairs: [string, string | boolean | number][] = [
    ["id", String(row.id ?? "")],
    ["shop", String(row.shop ?? "")],
    ["state", String(row.state ?? "")],
    ["isOnline", Boolean(row.is_online)],
    ["accessToken", String(row.access_token ?? "")],
    ["scope", String(row.scope ?? "")],
  ];
  if (row.expires) {
    pairs.push(["expires", new Date(row.expires as string).toISOString()]);
  }
  return Session.fromPropertyArray(pairs);
}

export const supabaseSessionStorage = {
  async storeSession(session: Session): Promise<boolean> {
    try {
      const obj = session.toObject();
      const db = getDb();
      await db`
        INSERT INTO shopify_sessions
          (id, shop, state, is_online, access_token, scope, expires, updated_at)
        VALUES (
          ${obj.id},
          ${obj.shop},
          ${obj.state ?? null},
          ${obj.isOnline ?? false},
          ${obj.accessToken ?? null},
          ${obj.scope ?? null},
          ${obj.expires ? new Date(obj.expires) : null},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          shop         = EXCLUDED.shop,
          state        = EXCLUDED.state,
          is_online    = EXCLUDED.is_online,
          access_token = EXCLUDED.access_token,
          scope        = EXCLUDED.scope,
          expires      = EXCLUDED.expires,
          updated_at   = NOW()
      `;
      return true;
    } catch (err) {
      console.error("[sessionStore] storeSession failed:", err);
      return false;
    }
  },

  async loadSession(id: string): Promise<Session | undefined> {
    try {
      const db = getDb();
      const rows = await db`SELECT * FROM shopify_sessions WHERE id = ${id}`;
      if (!rows.length) return undefined;
      return rowToSession(rows[0] as Record<string, unknown>);
    } catch (err) {
      console.error("[sessionStore] loadSession failed:", err);
      return undefined;
    }
  },

  async deleteSession(id: string): Promise<boolean> {
    try {
      const db = getDb();
      await db`DELETE FROM shopify_sessions WHERE id = ${id}`;
      return true;
    } catch (err) {
      console.error("[sessionStore] deleteSession failed:", err);
      return false;
    }
  },

  async deleteSessions(ids: string[]): Promise<boolean> {
    try {
      if (!ids.length) return true;
      const db = getDb();
      await db`DELETE FROM shopify_sessions WHERE id = ANY(${ids})`;
      return true;
    } catch (err) {
      console.error("[sessionStore] deleteSessions failed:", err);
      return false;
    }
  },

  async findSessionsByShop(shop: string): Promise<Session[]> {
    try {
      const db = getDb();
      const rows = await db`SELECT * FROM shopify_sessions WHERE shop = ${shop}`;
      return rows.map((row) => rowToSession(row as Record<string, unknown>));
    } catch (err) {
      console.error("[sessionStore] findSessionsByShop failed:", err);
      return [];
    }
  },
};

export const sessionStorage = supabaseSessionStorage;
