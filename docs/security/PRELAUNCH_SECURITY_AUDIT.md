# Ghostwritter prelaunch security audit

Verified: 2026-09-07. Scope: the complete repository, final candidate, reachable Git history, application routes, server code, database migrations, dependencies, CI, build configuration, and documented deployment assumptions.

## Executive verdict

**DO NOT LAUNCH.** The repository now defaults to zero live AI spend and contains the required server-side financial boundary, but the production database migration, approved-user provisioning, browser authentication path, trusted-proxy choice, provider project controls, hosting secret isolation, and alert routing have not been applied or observed in a real environment. A formal Codex Security Deep Scan was also attempted after TAC1 access was granted, but its launcher failed with `unexpected argument '--thread-source'`; this audit must not be interpreted as a successful formal Deep Scan or a no-findings result. The exact terminal failure is preserved in `LAUNCH_GATE.md`.

## System and trust boundaries

- Browser: untrusted input, cookies, bearer token, CSRF token, proof-of-work result, idempotency key, and UI state.
- Next.js server: validates transport and schemas, verifies the Supabase user, owns prompts/model/limits, and is the only code allowed to dispatch paid AI.
- Supabase Auth: authoritative user identity and verified-email status.
- Supabase PostgreSQL: authoritative beta entitlement, quotas, concurrency, idempotency, operation state, and financial reservations. The service-role credential bypasses RLS and is therefore high impact.
- Groq: external paid execution boundary. It cannot share a transaction with PostgreSQL; ambiguous dispatches are retained as `uncertain` at full reservation.
- Hosting proxy/CDN: authoritative source of a configured client-IP header only after Miguel verifies the real topology. IP is secondary defense, never financial authority.
- GitHub Actions and dependency registries: supply-chain boundary. CI receives no production runtime secrets in the repository workflow.
- Public artifact pages: opt-in read surface. Closed-beta production validation requires this feature to remain disabled.

No upload, URL-ingestion, SSRF-capable fetch, queue, worker, cron, payment, email, SMS, analytics, or error-reporting integration was found. The portfolio film route is a static/prerecorded development demonstration and does not call a provider.

## Security invariants

1. No provider dispatch occurs without a durable prior reservation.
2. Atomic admission counts settled, reserved, dispatched, and uncertain cost against every applicable budget.
3. No client field can change provider, model, prompt authority, token ceiling, retry count, pricing, entitlement, or budget.
4. Anonymous and unverified users receive zero owner-funded generations.
5. Missing or failed durable accounting denies AI.
6. Missing, stale, or unknown pricing denies AI.
7. An idempotency key cannot create duplicate provider work.
8. Provider credentials remain server-only and are guarded from client imports.
9. `AI_ENABLED` defaults to false and is checked immediately before dispatch.
10. Every owner-funded AI path goes through `executeGovernedRewrite`.

## Findings

| ID | Severity | Initial condition | Current repository state | Launch status |
| --- | --- | --- | --- | --- |
| GW-001 | P0 | `/api/ghostwriter` could reach paid AI without an authenticated, verified, entitled account. Frontend controls could be bypassed directly. | Central gateway verifies a Supabase bearer token and email, then requires a server-side beta entitlement. Anonymous/forged/expired identities are covered by zero-dispatch tests. | Code fixed; browser login/session integration and real approved-user flow remain required. |
| GW-002 | P0 | No durable atomic reservation, global budget, or cross-instance concurrency boundary existed. Concurrent requests could overspend. | PostgreSQL migration adds an atomic reservation RPC, integer micro-USD ledger, unique idempotency constraint, per-account/global concurrency and rate limits, and hour/24h/lifetime budgets. | Migration is not yet proven applied to production; launch blocker remains operationally open. |
| GW-003 | P0 | Rewrite Lab issued three parallel candidates and an evaluator call, multiplying cost fourfold outside a financial gate. | Live Rewrite Lab is server-disabled and hidden on the live route. Its server module contains no provider fetch. Static film/demo data remains available. | Fixed in repository. |
| GW-004 | P0 | No default-off global AI kill switch, fixed model allowlist, or recognized pricing version. | `AI_ENABLED` is false by default; provider/model/pricing are exact server allowlists; invalid/missing configuration fails closed. | Fixed in repository; production enablement must follow the launch gate. |
| GW-005 | P0 | No durable idempotency or explicit ambiguous-dispatch handling. Network retries/disconnects could duplicate spend. | Every generation requires a durable key and HMAC request fingerprint. Same request replays only a settled success; conflicts reject; dispatched/uncertain operations never regenerate. Upstream retries are exactly zero. | Fixed in repository. |
| GW-006 | P0 | Dependency audit reported seven high and one moderate vulnerability, including framework/image-processing/build-chain issues. | Security-relevant packages and transitive overrides were pinned; `npm audit` reports zero known vulnerabilities. | Fixed at verification time; continuous updates remain required. |
| GW-007 | P0 | Production/preview credential scope, Groq project limits, auto-funding state, Supabase Auth policy, and hosting topology cannot be established from source. | Exact console checklist and safe environment template added. No external setting was mutated. | **Open launch blocker.** Owner must verify every external step. |
| GW-008 | P0 | The product has no complete user-facing Supabase sign-in/session flow. | The API now safely rejects calls without a real bearer token, which means enabling AI today would leave the live UI nonfunctional rather than insecure. | **Open launch blocker.** Build and test the invite-only auth UX before approving accounts. |
| GW-009 | P1 | Forwarded-IP trust could be misconfigured at deployment, allowing spoofed secondary abuse identities. | Production validation requires an explicit allowlisted header and `GHOSTWRITER_TRUST_PROXY=true`; parsing normalizes addresses. | Header choice must be verified against the actual single trusted proxy hop. |
| GW-010 | P1 | Public sharing increases privacy and enumeration surface. | Sharing is opt-in, artifact-token protected, private by default, and closed-beta production validation forbids enabling it. Base-table reads are revoked. | Keep disabled for initial beta; re-audit before enabling. |
| GW-011 | P1 | Auth signup, verification-email, reset-email, CAPTCHA hostname/action, invite expiry, and account deletion behavior are external or absent. | Entitlement slots are finite and are not automatically re-minted on account deletion/recreation. Global budgets bound farming. | Configure invite-only verified accounts and email/bot controls externally; test before launch. |
| GW-012 | P1 | Automated deep security scan coverage could not be completed. | TAC1 was granted, but the Deep Scan launcher failed with the exact CLI argument error recorded above and returned no scan ID or manifest. Manual audit and adversarial tests continued. | Tooling gap must be resolved or an equivalent independent review completed. |
| GW-013 | P2 | Structured security events had partially revealing identifiers and no explicit ambiguous-operation alert type. | Sensitive identifiers are SHA-256 truncated hashes; prompt/output/auth/cookie/provider-key values are not logged. `ai_operation_uncertain` exists. | External aggregation, sampling, retention, and alert delivery remain unconfigured. |
| GW-014 | P2 | Provider ledger reconciliation cannot be fully automated from the codebase and billing data can lag. | Manual reconciliation RPC and incident procedure preserve full ambiguous reservations. | Reconcile against provider exports/dashboard; disable AI on unexplained mismatch. |
| GW-015 | P2 | Hosting, database, logs, bandwidth, and auth email can still accrue cost even with AI disabled. | Infrastructure inventory and shutdown mechanisms are documented. Request/challenge/state-changing endpoints have layered cheap rejection. | Real plan quotas and hard caps must be recorded; total loss is not bounded to the $10 AI budget. |
| GW-016 | P2 | Ledger result payloads and abuse rows require lifecycle maintenance. | Database functions expire stored result payloads and prune abuse records without erasing charged financial history. | Schedule reviewed maintenance after launch; do not create AI jobs. |
| GW-017 | P3 | Production source maps and development overlays increase source exposure/noise. | Browser source maps are explicitly disabled; Next development indicators remain disabled; no secret is allowed in client code regardless. | Fixed as defense in depth. |
| GW-018 | P3 | Historical secret scanning produced three generic-key findings. | All three were reviewed as synthetic CI/test fixtures and ignored only by their exact Gitleaks fingerprints. A pinned Gitleaks v8.30.1 full-history rerun reports no leaks. | No known active leaked secret found; repository scanning cannot prove external handling was safe. |

## Adversarial paths and disposition

### Spend amplification

- Direct curl/Postman, forged user/role/credits, new session, new IP: bearer identity and database entitlement remain authoritative.
- Request storms: one serializable admission boundary uses a global transaction advisory lock; rejected requests never enter a queue.
- Duplicate POST/browser refresh/retry: durable `(account_id, idempotency_key)` uniqueness and fingerprint comparison prevent duplicate dispatch.
- Timeout, connection reset, provider 429/500, malformed usage, client abandonment, or settlement failure: operation becomes `uncertain`, keeps full reservation, and is never retried automatically.
- Model/token/prompt/tool manipulation: strict schemas reject unknown fields; provider body is rebuilt from fixed server policy; no tools, retrieval, fallback, streaming, batch, or agent loop exists.
- Huge/compressed input: non-JSON and non-identity encoding reject; streaming body reader stops at 10,000 bytes without trusting `Content-Length`; prompt plus fixed system material uses a conservative UTF-8 byte upper bound capped at 2,000 input tokens.
- Account farming: at most 25 explicit entitlement slots and ten lifetime generations per entitlement; deletion has no automatic issuance path; global lifetime spend remains authoritative.

### Credential and data theft

- Provider and service-role keys occur only in server configuration; provider code imports a server-only guard.
- Security logs hash identities and do not serialize headers, tokens, prompt text, or rewrite text.
- Generated content renders as React text; no `dangerouslySetInnerHTML` or imperative `.innerHTML` sink is used.
- Artifact writes/feedback require short-lived signed provenance; public artifact reads expose only deliberately public, masked data through a bounded short-ID RPC.
- CSP, HSTS in production, MIME sniffing protection, referrer policy, frame restrictions, and permissions policy are set centrally.
- No user-controlled URL fetch or file upload exists, removing the initial SSRF/upload amplification classes.

### Infrastructure exhaustion

- Browser guard, same-origin/CSRF checks, body limit, challenge replay defense, and ingress limits reject before AI.
- Durable abuse controls fail closed in production; the AI financial ledger is independently authoritative even when IPs rotate.
- There is no queue or background generation path to amplify work later.
- Remaining hosting/database/log/email overage depends on external plan controls and is therefore not claimed as financially capped by this repository.

## Verification performed

- Repository-wide provider, route, secret-name, rendering-sink, queue/job, URL-fetch, upload, CI, deployment, and dependency searches.
- Full Git history secret scan with Gitleaks v8.30.1 and exact fingerprint review.
- Adversarial mock-provider tests: a 100-way $0.02/$0.01 race admitted exactly two provider calls and settled 136 micro-USD; 50-way account/global storms admitted one/two calls; identity, idempotency, uncertainty, outage, pricing, oversize, kill-switch, IDOR, and XSS paths were rejected or quarantined as designed.
- Clean PostgreSQL 16 integration: 100-way financial race admitted 2 and reserved 20,000 micro-USD; 100-way production-reservation global storm admitted 2 and reserved 1,500 micro-USD; 50-way account storm admitted 1 and reserved 750 micro-USD; anonymous RPC execution was denied and service-role execution allowed.
- Lint and TypeScript passed; the security/unit suite passed 115/115; scroll integrity passed 22/22; E2E passed 136/136 across Chromium, Firefox, WebKit, and Mobile Chrome; the production webpack build passed with AI disabled; `npm audit --audit-level=moderate` reported zero known vulnerabilities.

The audit is point-in-time. It does not substitute for external configuration verification, an independent penetration test, or provider/database account review.
