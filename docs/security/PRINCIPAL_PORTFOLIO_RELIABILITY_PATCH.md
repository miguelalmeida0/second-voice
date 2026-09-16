# Second Voice — Principal Portfolio Reliability Patch

## Acceptance contract

This patch preserves the current authenticated product while making the recruiter demo durable:

- GitHub OAuth/PKCE remains supported and refreshable.
- Authenticated visitors keep **3 rewrites per rolling 24 hours**, with all three usable consecutively while allowance remains.
- Anonymous visitors can perform **3 real rewrites per UTC day** without signing in.
- A fourth anonymous rewrite is rejected before provider dispatch.
- Anonymous and authenticated traffic share hard global daily, burst, concurrency and financial ceilings.
- No paid/provider fallback was added.
- The old `free_verified_until`, `valid_until`, and `retire_at` calendar dates no longer cause automatic portfolio outages.
- Explicit pause, manual retirement, unresolved provider liability, stale maintenance, invalid provider/model config and database-size hard stop still fail closed.
- `pg_cron` maintenance is idempotent.
- A daily external Vercel heartbeat performs real application → Supabase activity and health/size checks.
- A second GitHub Actions health watch runs every six hours.
- Daily encrypted PostgreSQL exports are prepared with 30-day artifact retention.

## Required production values

Do not put secret values in the repository.

Vercel production:

```text
CRON_SECRET=<32+ random characters>
GHOSTWRITER_ANONYMOUS_GLOBAL_DAILY_LIMIT=60
```

GitHub Actions:

```text
CRON_SECRET=<same value as Vercel>
SUPABASE_DB_URL=<Supabase Postgres connection string>
BACKUP_ENCRYPTION_KEY=<32+ random characters, also stored outside GitHub>
```

## Apply to the existing local project

Use Node 22.23.2. Preserve `.env.local` and the existing git history.

```bash
cd /Users/malmeida/Documents/mockup/ghostwritter
nvm use 22.23.2
```

After copying the patch files into this working tree:

```bash
npm ci
npx tsc --noEmit
npm run lint
node --test --experimental-strip-types \
  tests/portfolio-access.test.ts \
  tests/portfolio-reliability.test.ts \
  tests/target-policy.test.ts
```

## Apply the forward Supabase migration

```bash
npx --cache .tmp/npm-release --yes supabase db push --linked --dry-run
```

The new migration expected from this patch is:

```text
202609150001_ghostwriter_portfolio_reliability.sql
```

Then:

```bash
npx --cache .tmp/npm-release --yes supabase db push --linked
```

Do not run `db reset --linked`.

## Reinstall the one canonical retention job

```bash
node scripts/release/operator.mjs schedule-maintenance \
  --target=postgres \
  --reason=portfolio_retention_maintenance_enabled \
  --approve=seven-day-content-ninety-day-trial \
  --execute \
  --database-id=6f5fb526-40c8-4be5-a9e5-a707fe48e8f7 \
  --management-project=oycnkdlmdhfhmuuyfyqt
```

Then enable the durable Free profile:

```bash
node scripts/release/operator.mjs enable-portfolio \
  --target=postgres \
  --reason=portfolio_reliability_release \
  --approve=verified-free-only \
  --execute \
  --database-id=6f5fb526-40c8-4be5-a9e5-a707fe48e8f7 \
  --management-project=oycnkdlmdhfhmuuyfyqt
```

## Verify the live database

```bash
PROJECT_REF=oycnkdlmdhfhmuuyfyqt

npx --cache .tmp/npm-release --yes supabase db query \
  --linked \
  --project-ref "$PROJECT_REF" \
  "select public.ghostwriter_portfolio_health();
   select jobid,jobname,schedule,active from cron.job where jobname='ghostwriter-retention';
   select release_profile,paused,valid_until,free_verified_at,free_verified_until from public.ghostwriter_ai_control where singleton;"
```

Required state:

- `releaseActive: true`
- `controlValid: true`
- `cronActive: true`
- exactly one `ghostwriter-retention` job
- cron schedule `*/5 * * * *`
- `paused = false`
- portfolio `valid_until = infinity`
- database below its hard-size threshold

`free_verified_until` may remain populated as historical audit metadata. It is no longer a runtime calendar kill switch.

## Deploy to Vercel

Set `CRON_SECRET` and `GHOSTWRITER_ANONYMOUS_GLOBAL_DAILY_LIMIT=60` in the **Production** environment before deploying.

Then deploy the reviewed tree using the existing linked Vercel project, for example:

```bash
npx vercel --prod
```

The deployment registers this external heartbeat:

```text
GET /api/internal/portfolio-maintenance
Authorization: Bearer $CRON_SECRET
```

Vercel Cron invokes it daily; the endpoint runs real Supabase maintenance and size/health checks.

## Enable and prove backups

Configure the GitHub Actions secrets listed above. Then manually run **Portfolio Database Backup** once.

Acceptance requires:

1. workflow succeeds;
2. artifact contains only encrypted `.dump.enc` + checksum, never plaintext dump;
3. artifact is downloaded;
4. SHA-256 is verified;
5. the backup decrypts successfully with the separately stored key.

## Recruiter acceptance

Use a fresh incognito browser against production.

Anonymous journey:

1. Open `/second-voice`.
2. No sign-in wall.
3. Button is enabled.
4. Rewrite #1 succeeds.
5. Rewrite #2 succeeds immediately.
6. Rewrite #3 succeeds immediately.
7. Fourth rewrite is disabled/rejected and must not dispatch to Groq.
8. Refresh/new tab does not reset the signed visitor allowance.

GitHub journey:

1. Click **Sign in**.
2. GitHub → Supabase PKCE callback succeeds.
3. Callback returns to `/second-voice?auth=complete`.
4. Button is enabled if authenticated rolling-24h allowance remains.
5. Three rewrites can be consumed consecutively.
6. After three starts, button disables until an earlier rewrite leaves the rolling 24-hour window.
7. Refresh token recovery preserves the authenticated session.
8. Sign out returns to anonymous mode.

## Free-plan limitation

The external heartbeat substantially reduces Supabase Free inactivity-pause risk by generating regular real application-to-database activity. It cannot turn a Free-plan policy into a contractual uptime guarantee. If Supabase changes or enforces Free-plan pausing independently, only moving to a non-pausing plan/provider removes that platform-level risk completely.
