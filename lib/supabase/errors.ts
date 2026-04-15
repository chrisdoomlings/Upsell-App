type PostgresLikeError = Error & {
  code?: string;
  routine?: string;
  table_name?: string;
  relation?: string;
  message: string;
};

const MISSING_TABLE_CODE = "42P01";
const SCHEMA_HINT = "Supabase schema is not initialized. Run the SQL in supabase/bootstrap.sql, then retry.";

export function explainDatabaseError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;

  const pgError = error as PostgresLikeError;
  if (pgError.code === MISSING_TABLE_CODE || /relation .* does not exist/i.test(pgError.message)) {
    return `${pgError.message}. ${SCHEMA_HINT}`;
  }

  return pgError.message || fallback;
}
