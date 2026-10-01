select public.ghostwriter_ai_reserve(
  :'account_id'::uuid,
  :'idempotency_key',
  repeat('a', 64),
  'groq-openai-gpt-oss-20b-2026-09-07',
  :reservation_micro_usd,
  25,
  10,
  5,
  3,
  :account_concurrency,
  10,
  :global_concurrency,
  :hour_budget_micro_usd,
  :day_budget_micro_usd,
  :lifetime_budget_micro_usd
);
