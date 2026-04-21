import { getDb } from "@/lib/supabase/client";

export type BxgyEventType = "qualified" | "auto_added";

export interface BxgyRuleStat {
  ruleId: string;
  qualified: number;
  autoAdded: number;
  conversionRate: string;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function trackBxgyEvent(shop: string, ruleId: string, event: BxgyEventType): Promise<void> {
  const db = getDb();
  const col = event === "qualified" ? "qualified" : "auto_added";
  await db`
    INSERT INTO bxgy_stats (shop, rule_id, date, qualified, auto_added)
    VALUES (${shop}, ${ruleId}, ${todayKey()}::date, 0, 0)
    ON CONFLICT (shop, rule_id, date) DO UPDATE SET
      ${db.unsafe(col)} = bxgy_stats.${db.unsafe(col)} + 1
  `;
}

export async function getBxgyRuleStats(shop: string, ruleIds: string[]): Promise<BxgyRuleStat[]> {
  if (!ruleIds.length) return [];
  const db = getDb();
  const rows = await db`
    SELECT rule_id,
           SUM(qualified)  AS qualified,
           SUM(auto_added) AS auto_added
    FROM bxgy_stats
    WHERE shop = ${shop} AND rule_id = ANY(${ruleIds})
    GROUP BY rule_id
  `;

  return ruleIds.map((ruleId) => {
    const row = rows.find((r) => String((r as Record<string, unknown>).rule_id) === ruleId) as Record<string, unknown> | undefined;
    const qualified = Number(row?.qualified)  || 0;
    const autoAdded = Number(row?.auto_added) || 0;
    return {
      ruleId,
      qualified,
      autoAdded,
      conversionRate: qualified > 0 ? ((autoAdded / qualified) * 100).toFixed(1) + "%" : "—",
    };
  });
}
