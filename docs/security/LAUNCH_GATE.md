> Continuation: the newer forward migrations, auth flow, and executable gates are described in [DEPLOYMENT_READINESS.md](DEPLOYMENT_READINESS.md). Historical checked items below do not replace current .tmp/release/evidence.json or target verification.

# Ghostwritter security launch gate

Owner: Miguel. Review date: 2026-09-07. Current verdict: **DO NOT LAUNCH**.

Checked means proven in repository/tests or independently evidenced in the target environment. Repository implementation alone does not close an external-console item.

## P0 product and financial boundary

- [x] anonymous owner-funded AI is impossible at the server gateway
- [x] provider API key is server-only in source architecture
- [x] central owner-funded AI choke point is complete
- [x] strict provider/model/pricing allowlist
- [x] strict unknown-field-rejecting request schema
- [x] streaming 10,000-byte request cap and compressed-body rejection
- [x] conservative 2,000-token total-input cap
- [x] fixed 2,000-token completion cap
- [x] computed 750-micro-USD reservation fits the $0.01 per-operation ceiling
- [x] durable pre-spend reservation schema/RPC exists
- [x] atomic global hour/24h/lifetime budget enforcement exists
- [x] $0.50 hourly, $2 rolling-24h, and $10 lifetime beta budgets
- [x] ten lifetime generations per approved entitlement
- [x] per-account minute/day limits
- [x] global minute limit
- [x] per-account concurrency one
- [x] global concurrency two
- [x] durable idempotency key and fingerprint
- [x] zero automatic paid retries
- [x] dispatched/uncertain operation quarantine and full reservation retention
- [x] budget/pricing/datastore failure closes AI
- [x] `AI_ENABLED=false` is the safe default and is rechecked before dispatch
- [x] Rewrite Lab live multi-pass spend path is disabled
- [ ] production migration `202609070001_ghostwriter_ai_financial_boundary.sql` applied and independently verified
- [ ] at most 25 production entitlement slots manually issued to intended verified accounts
- [ ] complete browser sign-in/session/logout path implemented and adversarially tested

## Secrets, provider, hosting, and preview

- [x] `.env*` remains ignored and sanitized `.env.example` is tracked
- [x] full reachable Git history scanned with pinned Gitleaks and exact false-positive fingerprints
- [x] no known leaked active secret found in that scan
- [x] CI secret scan uses full checkout and immutable action references
- [x] production browser source maps explicitly disabled
- [ ] current production credentials rotated if they predate the audit, were shared, or crossed an untrusted channel
- [ ] production/development/staging credentials proven separate
- [ ] preview/PR deployments proven to receive neither production Groq nor Supabase service-role credentials
- [ ] dedicated Groq production project and restricted inference credential created
- [ ] Groq model/rate/spend controls configured and recorded
- [ ] automatic funding/reload disabled or explicitly risk-accepted with a maximum exposure
- [ ] hosting production environment contains exact validated variables and keeps `AI_ENABLED=false` during rollout
- [ ] actual trusted proxy/CDN and authoritative client-IP header verified
- [ ] production/preview/old deployment and domain inventory completed; forgotten AI credentials removed

## Application and data protection

- [x] generated text renders without HTML execution sinks
- [x] object ownership/provenance tests cover cross-account operation access and public artifact state
- [x] same-origin, CSRF, secure-cookie, session-expiry, and challenge replay checks exist
- [x] restrictive CSP/frame/referrer/MIME/permissions headers reviewed
- [x] public sharing is disabled by production closed-beta validation
- [x] no URL ingestion, SSRF path, file upload, payment, queue, cron, or background AI path found
- [x] logs avoid auth/cookie/key/prompt/output contents and hash sensitive identifiers
- [ ] Supabase Auth set to invite-only/approved flow with verified email, finite single-use invitation process, and tested logout/session invalidation
- [ ] verification/reset email rate limits and CAPTCHA/hostname/action controls configured and tested if those flows are enabled
- [ ] Supabase RLS, grants, function ownership/search paths, backups/PITR, pooling, and network policy verified in the target project

## Cost operations and observability

- [x] infrastructure cost-source inventory exists
- [x] emergency AI/key/datastore/compromise runbook exists
- [x] manual uncertain-operation reconciliation RPC and procedure exist
- [ ] hosting, database, Auth email, logs, bandwidth, CI, DNS/CDN plan limits and overage behavior recorded
- [ ] structured security events routed to a bounded-retention sink without private text
- [ ] alerts configured for 50%, 80%, and 100% beta budget, dispatch spike, accounting failure, config failure, and unexpected provider activity
- [ ] daily/provider reconciliation owner and cadence assigned
- [ ] one controlled real-provider smoke test completed after all other gates; no load/chaos tests use real credits

## Verification

- [x] authentication/forgery zero-dispatch tests
- [x] 100-request financial race admits no more than two at a synthetic $0.02/$0.01 boundary
- [x] 50-request per-account storm admits at most one active dispatch
- [x] multi-account storm admits at most two active dispatches
- [x] lifetime/relogin/new-session and delete/recreate entitlement tests
- [x] idempotency replay/conflict tests
- [x] timeout/disconnect/429/500/malformed/settlement-failure chaos tests
- [x] datastore outage, pricing missing, oversize, kill switch, model/token manipulation tests
- [x] IDOR and XSS static/runtime contract tests
- [x] proxy spoofing and request/header/body tests
- [x] dependency audit has zero known vulnerabilities at review time
- [x] full-history secret scan passes with exact reviewed exceptions
- [x] security/unit suite passes
- [x] scroll-integrity suite passes
- [x] lint passes in final clean verification
- [x] typecheck passes in final clean verification
- [x] E2E passes in final clean verification (136/136: Chromium, Firefox, WebKit, and Mobile Chrome)
- [x] production build passes in final clean verification with AI disabled and browser source maps disabled
- [x] PostgreSQL migration syntax and transactional invariants pass against a clean PostgreSQL 16 database
- [ ] formal Deep Security scan succeeds, or an equivalent independent security review accepts the recorded scanner limitation
- [x] final `git diff --check`, staged secret scan, status, and diff review complete

The formal scanner item is unchecked because the runner returned no scan ID or manifest and exited with:

```text
Codex Exec exited with code 2: error: unexpected argument '--thread-source' found

  tip: to pass '--thread-source' as a value, use '-- --thread-source'

Usage: codex exec [OPTIONS] [PROMPT]
       codex exec [OPTIONS] <COMMAND> [ARGS]
```

This is a review-coverage failure, not a no-findings result.

## Independent local verification

Run from the repository root. These commands use no production credential. The synthetic build values are deliberately non-secret and AI remains disabled.

```bash
npm ci

mkdir -p .tmp
docker run --rm \
  -v "$PWD:/repo:rw" \
  zricethezav/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f \
  git --gitleaks-ignore-path=/repo/.gitleaksignore --redact --no-banner \
  --report-format=json --report-path=/repo/.tmp/gitleaks-verified.json /repo

npm run test:unit
npm run test:security
npm run test:concurrency
npm run test:integration
npm run lint
npx tsc --noEmit

env \
  NODE_ENV=production \
  AI_ENABLED=false \
  GHOSTWRITER_PROVIDER=groq \
  GHOSTWRITER_ABUSE_STORE_MODE=supabase \
  GHOSTWRITER_ALLOW_PUBLIC_SHARING=false \
  GHOSTWRITER_E2E_FIXTURE_MODE=false \
  GHOSTWRITER_CLIENT_IP_HEADER=x-forwarded-for \
  GHOSTWRITER_SECURITY_SECRET="$(openssl rand -hex 32)" \
  GHOSTWRITER_TRUST_PROXY=true \
  NEXT_PUBLIC_SITE_URL=https://ghostwriter.example \
  SUPABASE_PUBLISHABLE_KEY=ci-publishable-key \
  SUPABASE_SERVICE_ROLE_KEY=ci-service-role-key \
  SUPABASE_URL=https://supabase.example \
  npm run security:check

env \
  AI_ENABLED=false \
  GHOSTWRITER_PROVIDER=groq \
  GHOSTWRITER_ABUSE_STORE_MODE=supabase \
  GHOSTWRITER_ALLOW_PUBLIC_SHARING=false \
  GHOSTWRITER_E2E_FIXTURE_MODE=false \
  GHOSTWRITER_CLIENT_IP_HEADER=x-forwarded-for \
  GHOSTWRITER_SECURITY_SECRET="$(openssl rand -hex 32)" \
  GHOSTWRITER_TRUST_PROXY=true \
  NEXT_PUBLIC_SITE_URL=https://ghostwriter.example \
  SUPABASE_PUBLISHABLE_KEY=ci-publishable-key \
  SUPABASE_SERVICE_ROLE_KEY=ci-service-role-key \
  SUPABASE_URL=https://supabase.example \
  npm run build -- --webpack

npm audit --audit-level=moderate
```

Browser verification is separate because it is the longest gate:

```bash
npm run test:e2e
```

The recommended final sequence is:

```bash
npm ci && \
npm run test:unit && \
npm run test:security && \
npm run test:concurrency && \
npm run test:scroll && \
npm run test:integration && \
npm run lint && \
npx tsc --noEmit && \
npm run test:e2e && \
npm audit --audit-level=moderate
```

Then run the pinned Gitleaks command, production `security:check`, and production build command above exactly as separate final gates. This separation keeps failures attributable and avoids placing even synthetic credential-shaped strings into a reusable shell environment.

## Approval rule

Ghostwritter cannot be labeled ready for unrestricted live AI while any P0 or unchecked required production item remains. Enabling `AI_ENABLED=true` is a deliberate final act after evidence is attached to every relevant checkbox; it is never part of a normal deploy by default.
