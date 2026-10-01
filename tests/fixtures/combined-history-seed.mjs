/**
 * Historical-row fixture adapter used ONLY by the disposable Docker ledger tests.
 * Production SQL cannot insert pre-settled operations through the new admission
 * trigger. The old retention/window tests intentionally synthesize such history.
 * Disable only the new trigger while writing that fixture, then restore it before
 * exercising any production RPC. This must never be used against a live database.
 */
export function seedCombinedHistory(sql, statement) {
  const guarded = sql("select exists(select 1 from pg_trigger where tgname='ghostwriter_00_combined_ai_cap' and tgrelid='public.ghostwriter_ai_operations'::regclass);") === "t";
  if (guarded) sql("alter table public.ghostwriter_ai_operations disable trigger ghostwriter_00_combined_ai_cap;");
  try {
    sql(statement);
    if (guarded) sql("update public.ghostwriter_ai_operations set global_dispatch_authorized_at=dispatched_at where global_dispatch_authorized_at is null and dispatched_at is not null;");
  } finally {
    if (guarded) sql("alter table public.ghostwriter_ai_operations enable trigger ghostwriter_00_combined_ai_cap;");
  }
}
