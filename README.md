# Ghostwriter

Ghostwriter is a `Next.js 16` rewrite app with a protected browser-to-server inference flow, explicit provider selection, opt-in public artifacts, and private quality feedback capture.

## Required production env

```bash
GHOSTWRITER_PROVIDER=groq
GROQ_API_KEY=...
GHOSTWRITER_SECURITY_SECRET=32+ random chars
GHOSTWRITER_TRUST_PROXY=true|false
GHOSTWRITER_ABUSE_STORE_MODE=supabase
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SITE_URL=https://ghostwriter.example
```

Optional:

```bash
GROQ_MODEL=openai/gpt-oss-20b
GHOSTWRITER_ALLOW_PUBLIC_SHARING=false
GHOSTWRITER_SHARE_SOURCE_TEXT=false
GHOSTWRITER_POW_DIFFICULTY=4
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
```

## Security posture

- Provider selection is explicit through `GHOSTWRITER_PROVIDER`. The app does not silently fall back across vendors.
- `/ghostwriter` issues a signed browser session and CSRF token through `proxy.ts`.
- `/api/ghostwriter/challenge`, `/api/ghostwriter`, `/api/ghostwriter/lab`, `/api/ghostwriter/share`, and `/api/ghostwriter/feedback` enforce same-origin checks, CSRF, signed sessions, proof-of-work, layered rate limits, and durable replay tracking before state changes or model calls.
- Production abuse protection now requires a shared Supabase-backed store. In-memory mode is development-only.
- Public sharing requires an explicit UI request and `GHOSTWRITER_ALLOW_PUBLIC_SHARING=true`. New public artifacts store rewritten output only by default.
- Public share pages and OG images read through the `ghostwriter_public_rewrites` view, not the base table.
- Legacy rows are private by default. Public-artifact migrations set `is_public=false` and only expose rows that were explicitly shared. Base-table `input_text` is preserved, but public reads mask it unless `source_visible=true`.
- Feedback stores author, mood, provenance, rating, reason, request ID, and a SHA-256 rewrite hash only. It does not store source text or rewritten text.
- Quality logs emit request-scoped metadata, model/provider, latency, schema/fallback status, and feedback outcomes without logging user text.

## Supabase rollout order

Apply migrations in this order before deploying the app code:

1. `supabase/migrations/202604230000_ghostwriter_rewrites_baseline.sql`
2. `supabase/migrations/202604230001_ghostwriter_hardening.sql`
3. `supabase/migrations/202604230002_ghostwriter_public_artifacts.sql`
4. `supabase/migrations/202604230003_ghostwriter_abuse_store.sql`
5. `supabase/migrations/202604230004_ghostwriter_artifact_provenance.sql`
6. `supabase/migrations/202604230005_ghostwriter_feedback.sql`
7. `supabase/migrations/202604230006_ghostwriter_public_artifacts_privacy_correction.sql`

What the follow-on migrations do:

- `202604230000` creates the baseline rewrite artifact table.
- `202604230001` hardens the base table with RLS and revokes anonymous access.
- `202604230002` adds explicit public/share visibility flags, defaults existing and future rows to private, preserves base-table `input_text`, and exposes a safe public view that masks source text by default.
- `202604230003` creates the durable shared abuse store plus atomic RPCs for rate limits, penalties, and one-time challenge use.
- `202604230004` adds public-safe provenance for Rewrite Lab winners.
- `202604230005` creates the private feedback table for binary user signals and reason tags without storing prompt or rewrite text.
- `202604230006` corrects any database that may have seen an earlier public-artifact migration by making existing rows private unless their `short_id` is explicitly allowlisted by service role before the correction runs.

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

- public readers only see `ghostwriter_public_rewrites`
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
npm run security:check
npm run test:release:gate
npm run test:security
npm run test:scroll
npx tsc --noEmit
npm run lint
npm run build -- --webpack
```
