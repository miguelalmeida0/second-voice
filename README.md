# Ghostwritter / Second Voice AI

Ghostwritter is a Next.js 16 rewrite app with author-style and outcome-based rewriting, private quality feedback, and opt-in public artifacts. Owner-funded inference is disabled by default and is available only through one authenticated, durable, financially bounded server gateway.

The current security verdict is **DO NOT LAUNCH** until the unchecked external and authentication requirements in [`docs/security/LAUNCH_GATE.md`](docs/security/LAUNCH_GATE.md) are complete.

## Required production env

```bash
AI_ENABLED=false
GHOSTWRITER_PROVIDER=groq
GROQ_MODEL=openai/gpt-oss-20b
GHOSTWRITER_AI_PRICING_VERSION=groq-openai-gpt-oss-20b-2026-09-07
GROQ_API_KEY=
GHOSTWRITER_SECURITY_SECRET=
GHOSTWRITER_TRUST_PROXY=true
GHOSTWRITER_CLIENT_IP_HEADER=x-forwarded-for
GHOSTWRITER_ABUSE_STORE_MODE=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=https://ghostwriter.example

GHOSTWRITER_BETA_MAX_APPROVED_ACCOUNTS=25
GHOSTWRITER_AI_LIFETIME_GENERATIONS_PER_ACCOUNT=10
GHOSTWRITER_AI_ACCOUNT_GENERATIONS_PER_24H=5
GHOSTWRITER_AI_ACCOUNT_GENERATIONS_PER_MINUTE=3
GHOSTWRITER_AI_ACCOUNT_CONCURRENCY=1
GHOSTWRITER_AI_GLOBAL_GENERATIONS_PER_MINUTE=10
GHOSTWRITER_AI_GLOBAL_CONCURRENCY=2
GHOSTWRITER_AI_MAX_INPUT_TOKENS=2000
GHOSTWRITER_AI_MAX_OUTPUT_TOKENS=2000
GHOSTWRITER_AI_MAX_OPERATION_MICRO_USD=10000
GHOSTWRITER_AI_HOURLY_BUDGET_MICRO_USD=500000
GHOSTWRITER_AI_24H_BUDGET_MICRO_USD=2000000
GHOSTWRITER_AI_BETA_LIFETIME_BUDGET_MICRO_USD=10000000
GHOSTWRITER_AI_REQUEST_BODY_BYTES=10000
GHOSTWRITER_AI_REQUEST_TIMEOUT_MS=30000
```

Optional:

```bash
GHOSTWRITER_ALLOW_PUBLIC_SHARING=false
GHOSTWRITER_SHARE_SOURCE_TEXT=false
GHOSTWRITER_POW_DIFFICULTY=4 # supported range: 3-4
```

Copy `.env.example` for names and safe defaults. Do not copy real values into source, documentation, tests, or client-prefixed variables. Keep `AI_ENABLED=false` through deployment and migration; enable it only after the launch gate is signed off.

## Security posture

- Anonymous users receive zero live owner-funded generations. Live generation requires a valid Supabase bearer session, verified email, and a server-side approved-beta entitlement.
- Provider, model, endpoint, pricing, prompt, output ceiling, and retry behavior are server-owned. Groq `openai/gpt-oss-20b` is the only allowlisted live model; there is no vendor/model fallback.
- Every live generation requires a durable idempotency key and atomic PostgreSQL reservation before the one permitted provider fetch.
- The ledger enforces integer micro-USD operation/hour/rolling-24h/lifetime budgets, per-account lifetime/day/minute/concurrency limits, and global minute/concurrency limits across application instances.
- Provider ambiguity never triggers automatic regeneration. Dispatched/uncertain operations retain their full reservation until evidence-based reconciliation.
- Rewrite Lab's former multi-pass live AI pipeline is disabled for the initial closed beta.
- `/second-voice` issues a signed browser session and CSRF token through `proxy.ts`.
- `/api/ghostwriter/challenge`, `/api/ghostwriter`, `/api/ghostwriter/lab`, `/api/ghostwriter/share`, and `/api/ghostwriter/feedback` enforce same-origin checks, CSRF, signed sessions, proof-of-work, layered rate limits, and durable replay tracking before state changes or model calls.
- Production abuse limits require `GHOSTWRITER_TRUST_PROXY=true` plus an explicit trusted `GHOSTWRITER_CLIENT_IP_HEADER`; requests fail closed when a stable client IP cannot be resolved.
- Production abuse protection now requires a shared Supabase-backed store. In-memory mode is development-only.
- Successful rewrites and Rewrite Lab candidates return short-lived signed artifact tokens. Public sharing and feedback verify those tokens server-side instead of trusting client-supplied rewrite provenance.
- Public sharing requires an explicit UI request and `GHOSTWRITER_ALLOW_PUBLIC_SHARING=true`. New public artifacts store rewritten output only by default.
- Public share pages and OG images read through a service-defined short-id lookup RPC, not direct anonymous scans of the base table.
- Legacy rows are private by default. Public-artifact migrations set `is_public=false` and only expose rows that were explicitly shared. Base-table `input_text` is preserved, but public reads mask it unless `source_visible=true`.
- Feedback stores rewrite mode, author/outcome metadata, mood, provenance, rating, reason, request ID, and a SHA-256 rewrite hash only. It does not store source text or rewritten text.
- Quality logs emit request-scoped metadata, model/provider, latency, schema/fallback status, and feedback outcomes without logging user text.
- `AI_ENABLED` defaults to false. Missing pricing, credentials, entitlement, or durable accounting rejects generation.

Full architecture, audit, external-console steps, incident response, and cost limitations live in [`docs/security/`](docs/security/).

## Supabase rollout order

Apply migrations in this order before deploying the app code:

1. `supabase/migrations/202604230000_ghostwriter_rewrites_baseline.sql`
2. `supabase/migrations/202604230001_ghostwriter_hardening.sql`
3. `supabase/migrations/202604230002_ghostwriter_public_artifacts.sql`
4. `supabase/migrations/202604230003_ghostwriter_abuse_store.sql`
5. `supabase/migrations/202604230004_ghostwriter_artifact_provenance.sql`
6. `supabase/migrations/202604230005_ghostwriter_feedback.sql`
7. `supabase/migrations/202604230006_ghostwriter_public_artifacts_privacy_correction.sql`
8. `supabase/migrations/202605020001_ghostwriter_outcome_rewrites.sql`
9. `supabase/migrations/202605020002_ghostwriter_public_rewrite_lookup_rpc.sql`
10. `supabase/migrations/202609070001_ghostwriter_ai_financial_boundary.sql`

What the follow-on migrations do:

- `202604230000` creates the baseline rewrite artifact table.
- `202604230001` hardens the base table with RLS and revokes anonymous access.
- `202604230002` adds explicit public/share visibility flags, defaults existing and future rows to private, preserves base-table `input_text`, and exposes a safe public view that masks source text by default.
- `202604230003` creates the durable shared abuse store plus atomic RPCs for rate limits, penalties, and one-time challenge use.
- `202604230004` adds public-safe provenance for Rewrite Lab winners.
- `202604230005` creates the private feedback table for binary user signals and reason tags without storing prompt or rewrite text.
- `202604230006` corrects any database that may have seen an earlier public-artifact migration by making existing rows private unless their `short_id` is explicitly allowlisted by service role before the correction runs.
- `202605020001` adds public-safe rewrite mode and outcome metadata for outcome-based rewrites without exposing private source text.
- `202605020002` moves anonymous public artifact reads behind a short-id lookup RPC and revokes direct anonymous view scans.
- `202609070001` adds closed-beta entitlement slots, the durable AI operation/financial ledger, atomic admission/state-transition/reconciliation RPCs, service-role-only grants, and hardened security-definer search paths.

## Legacy data preservation

`202604230002_ghostwriter_public_artifacts.sql` and `202604230006_ghostwriter_public_artifacts_privacy_correction.sql` preserve existing `ghostwriter_rewrites.input_text` values. Privacy is enforced by private defaults, revoked base-table access, and public-view masking unless `source_visible=true`.

If a production database already contains rows with verified prior public-share consent, add a reviewed pre-correction allowlist migration that creates and populates `ghostwriter_public_rewrite_allowlist` with those `short_id` values before `202604230006` runs. With an empty allowlist, all existing rows become private. New public links created by the application remain public because the server share path writes `is_public=true` only after explicit user consent.

If an environment already ran an earlier destructive version of these migrations, this fix prevents future scrubbing but cannot restore source text that was already overwritten. Recovery would require a database backup from before that migration ran. Confirm whether the destructive migration ever ran before production deployment.

Suggested pre-migration review query:

```sql
select short_id, input_text, output_text, created_at
from public.ghostwriter_rewrites
where coalesce(input_text, '') <> '';
```

After the migration:

- public readers can only execute `ghostwriter_public_rewrite_lookup(short_id)`
- `input_text` is blank unless `source_visible=true`
- base-table `input_text` remains intact
- existing rows are reset to `is_public=false` and `source_visible=false` unless explicitly allowlisted

Rollback note:

- if an earlier destructive migration already ran, restore overwritten source text from a pre-migration backup
- do not re-open direct anon/authenticated access to `ghostwriter_rewrites`

## Abuse store operations

The durable abuse store lives in Supabase:

- `ghostwriter_abuse_counters`
- `ghostwriter_abuse_penalties`
- `ghostwriter_used_challenges`

Cleanup helper:

```sql
select public.ghostwriter_abuse_cleanup();
```

Run that on a schedule if your platform does not already prune old rows.

## Verification

For local development, `npm run security:check` loads `.env.local` when `NODE_ENV` is not `production`; existing shell environment variables still take precedence. CI runs `npm run security:check` with explicit production environment variables and does not rely on `.env.local`.

```bash
npm ci
npm run security:check
npm run test:unit
npm run test:concurrency
npm run test:security
npm run test:scroll
npm run test:integration
npm run test:e2e
npm audit --audit-level=moderate
npx tsc --noEmit
npm run lint
npm run build
```

The unit, concurrency, and security suites use local fixtures plus an in-memory transactional mock provider/ledger and never send paid provider requests. The integration suite starts the digest-pinned PostgreSQL 16 image locally. Run the digest-pinned full-history secret scan and the exact production build recipe documented in [`docs/security/LAUNCH_GATE.md`](docs/security/LAUNCH_GATE.md) before release.
