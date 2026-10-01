# Deployment readiness — continuation

The current deployment scope is the **limited Free-only portfolio**, documented in [PORTFOLIO_RELEASE.md](PORTFOLIO_RELEASE.md). The paid-mode verdicts and deferred matrix below are retained historical scope, not the portfolio gate. The continuation branch now exists; older read-only-Git observations below describe the earlier attempt.

Baseline: clean branch security/ghostwritter-prelaunch-hardening, HEAD 59cb8b3c58431ad970e42d378ecb83b8e592d18b. The continuation branch is now security/ghostwritter-deployment-ready; HEAD remains the reported baseline. Changes remain uncommitted while required release checks are blocked. No reset, push, production change, entitlement grant, or paid request was performed. The existing Tolkien/portfolio film in that commit is preserved.

## Repository changes

- Forward migrations 202609070002 and 202609070003 retain liabilities across rolling windows, reject null/under-reserved policies, fence dispatch with session/entitlement/pause checks, prohibit release after claim, and remove direct runtime financial writes.
- Supabase email-code authentication uses HTTP-only same-site cookies. getClaims verifies tokens and getUser checks current identity. SQL checks auth.sessions/auth.users and explicit revocation. Logout commits app-session revocation under the same advisory lock used by admission/dispatch before upstream sign-out.
- Signing uses HKDF-SHA256 with versioned purpose labels for shield, CSRF, challenge, and artifact signatures. Fingerprints use a separate long-lived GHOSTWRITER_FINGERPRINT_SECRET. Root rotation invalidates old shield/artifact tokens but does not change fingerprint identity. Fingerprint-key rotation must preserve history; conflicts are safe and must never be repaired by deleting operations.
- Provider redirects fail. Observed over-budget usage is recorded separately without clamping and pauses admission. Repeated observations retain the largest known liability; a lower or missing later value cannot erase it. An uncertain operation blocks subsequent admissions.
- Operator commands default to dry-run, require an exact database target for execution, and audit successful mutations. Runtime may pause but cannot resume. A one-row canary record permits only its fixed run/account/idempotency key and never replenishes its operation slot.
- verify:release generates sanitized evidence under .tmp/release. preflight gates are read-only and explicitly blocked until target-specific proof is available.

## Effective limits

Real provider transport is currently disabled in code, irrespective of AI_ENABLED. Anonymous paid starts: zero.

Proposed enabled policy ceilings remain unchanged: 25 approved lifetime slots; start with owner then at most five reviewed testers; 10 lifetime starts/account, 5/rolling day, 3/rolling minute, 1 active/account; 10 starts/minute globally, 2 active globally. SQL uses authoritative time after locking. Uncertain work does not free concurrency.

Request cap 10,000 bytes; policy input/output ceilings 2,000 each; provider deadline 30 seconds. Operation ceiling 10,000 micro-USD; rolling hour 500,000; rolling day 2,000,000; lifetime beta 10,000,000. Fixed migration policy reservation: 750 micro-USD. Lower limits never authorize under-reservation.

Attribution: unresolved maximum liabilities count in every rolling window regardless of age; settled actual costs count from settlement time. Lifetime history never resets. Starts include failed admissions that reached a reserved operation. No transaction spans a provider call.

## Unresolved provider bound

Groq's current page lists $0.075/M input and $0.30/M output for openai/gpt-oss-20b, yielding 750 micro-USD for 2,000+2,000 tokens. Reviewed 2026-09-07; code pricing expiry 2026-09-14. Cache discounts are excluded.

The former UTF-8 byte count plus 256 framing tokens is not proof of Groq-managed prompt framing and complete billable reasoning. resolveLiveAiPolicy therefore refuses live work. Removing this restriction requires a reviewed tokenizer/framing/billing contract and regression evidence; changing an environment variable cannot bypass it. Expired pricing also rejects policy resolution. A static pricing version cannot detect arbitrary external price changes.

Sources: https://console.groq.com/docs/model/openai/gpt-oss-20b and https://console.groq.com/docs/api-reference . These establish published prices/parameters, not account settings or the final invoice.

## Database permissions matrix

| Principal | Allowed | Denied |
|---|---|---|
| anon / authenticated | Existing deliberate public short-ID artifact lookup | All financial/entitlement tables and paid accounting RPCs |
| service_role runtime | Session check/revoke; reserve current overload; atomic claim; reserved-only failure; uncertainty; settlement; anomaly/pause | Direct financial table reads/writes, entitlement writes, legacy reserve overload, operator reconciliation, resume |
| postgres / restricted owner operator connection | Reviewed migrations, grant/revoke, pause, expected-state reconciliation, canary preparation | No application-exposed operator endpoint exists |

All new definer functions fix search_path to pg_catalog and qualify data objects. Existing runtime functions retain explicit grants. New objects revoke inherited PUBLIC/anon/authenticated/service_role table privileges. service_role still has broad Auth/admin power and is NOT an RLS-limited identity; consumers remain the isolated Supabase server client plus ledger, session RPC, abuse store, persistence/feedback. A compromised runtime/admin/provider credential is outside the normal application admission proof. A narrower independently configured runtime credential is still a deployment review item.

## Shutdown and recovery

Pause commits under the global reservation lock. After commit no new dispatch claim succeeds. A worker that won dispatch permission before pause may still send/finish; its full reservation remains. No claim of exactly-once external execution or retroactive cancellation is made.

Only reserved operations can be released automatically. Dispatched/uncertain operations require evidence-based operator reconciliation, with actual observed liability and an audit reason. Reconciliation stays paused. Already settled operations cannot be settled again. Do not expire uncertain work to restore concurrency.

Restore/rollback requires independently disabling AI outside restored state first, reconciling all activity after the backup, and verifying the current migration/gateway. The old reserve overload is denied to runtime. Never roll back by deleting ledger history. Operator event retention should be bounded by reviewed archival policy; financial rows and lifetime slots must remain. No automated event cleanup job is enabled by this change.

## Evidence and outstanding scope

The SQL race harness is real PostgreSQL with two HTTP processes and no in-memory ledger. Its financial fixture makes unrelated gates non-binding only in a disposable cloned SQL function. Removing financial checks admits 100 instead of 2; removing concurrency enforcement also defeats its dedicated test. Production migrations contain neither mutation.

A second harness runs the actual gateway and provider serializer/response validator in two HTTP worker processes against PostgreSQL, with injected authentication/finalization and mocked outbound fetch. It proves two admitted dispatches, 98 financial denials, settlement at 76 micro-USD, safe capacity reuse, and replay without redispatch (three total dispatches, 114 micro-USD settled). This still does not combine two Next HTTP handlers, real authentication and provider fault injection in one end-to-end test. No aggregate count establishes production readiness.

Remaining implementation/proof requirements: full integrated two-app-process accounting/provider failure harness; all requested late-worker/restore/recovery race cases; target-schema privilege inspection against actual Supabase defaults; authoritative complete token bound; operational target evidence; live one-operation canary. Do not label these complete because local SQL/build tests pass.

Use the generated .tmp/release/evidence.json for actual check status. It binds base commit, working diff and source-tree digests (including new files), build ID, production-artifact digest and timestamp; it contains no secret value or secret hash. The final evidence file itself is excluded from its source digest. The verifier records FAIL if source changes during checks, and shares its identity calculation with preflight. A continuation commit requires passing checks; none is claimed while the gate is blocked.

Verdicts until all required proof is attached: REPOSITORY VERIFICATION BLOCKED; AI-DISABLED DEPLOYMENT BLOCKED; OWNER-ONLY LIVE CANARY BLOCKED; LIVE BETA NOT VERIFIED.


## Secret inventory (names and metadata only)

| Name | Purpose/environment | Consumers and rotation |
|---|---|---|
| GROQ_API_KEY | Dedicated production inference; separate dev/test keys | ai-provider only; actual isolation/exposure unknown, owner-approved rotation if shared/exposed |
| SUPABASE_SERVICE_ROLE_KEY | Server runtime privileged access | Supabase server client, ledger, session checks/revocation, abuse/persistence/feedback; wide Auth/admin blast radius; external narrower privilege review pending |
| SUPABASE_PUBLISHABLE_KEY | Public project identity, not a secret | Auth client; separate project per environment |
| GHOSTWRITER_SECURITY_SECRET | Per-environment signing root | HKDF shield/CSRF/challenge/artifact keys; rotation invalidates tokens, root compromise compromises all derived purposes |
| GHOSTWRITER_FINGERPRINT_SECRET | Separate long-lived server fingerprint key | Gateway; preserve existing operation records across rotation; cannot equal root/provider/admin credential |
| GHOSTWRITER_CANARY_ACCESS_TOKEN | Ephemeral owner-only canary process identity | Canary harness only, never client bundle or reports |
| PGSERVICE / protected .pgpass | Named operator/migration connection / credential | Operator CLI; separate from web runtime; exact service plus database deployment UUID checked in the transaction |

Available Git history is not shallow. Gitleaks scanned four reachable commits; no remote fetch was performed, so unavailable remote/deleted refs are not claimed scanned. Existing exact .gitleaksignore exclusions are retained; current working diff/new files are scanned separately with redaction. Client build canaries use synthetic values only.

The actual Next HTTP integration has passed against GoTrue/PostgREST/PostgreSQL for OTP verification, account suspension, entitlement revocation, refresh races, expired-access logout, captured/racing-token rejection, durable admission rejection after logout and OTP replay denial. Browser rendering/interaction proof is independently BLOCKED by native macOS Mach-port permission denial; it must run in a permitted browser environment.
