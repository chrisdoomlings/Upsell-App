import postgres from "postgres";

function getDb() {
  const g = globalThis as unknown as { __supabaseDb?: postgres.Sql };
  if (!g.__supabaseDb) {
    const url = process.env.SUPABASE_DATABASE_URL;
    if (!url) throw new Error("SUPABASE_DATABASE_URL is not set");
    g.__supabaseDb = postgres(url, { max: 5, idle_timeout: 20, prepare: false });
  }
  return g.__supabaseDb;
}

export { getDb };
