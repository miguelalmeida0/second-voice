# AI and credential incident runbook

Availability is secondary to financial and data safety. When uncertain, disable AI first. Never paste secret values, bearer tokens, cookies, prompts, generated text, database URLs, or full provider responses into tickets or chat.

## Emergency AI shutdown

1. In the production hosting secret/configuration panel, set `AI_ENABLED=false`.
2. deploy/restart the production runtime so all instances receive the value;
3. verify an authenticated request returns AI unavailable and the provider request counter does not increase;
4. if dispatch may continue or configuration rollout is uncertain, revoke the production `GROQ_API_KEY` in Groq immediately;
5. leave existing `reserved`, `dispatched`, and `uncertain` ledger entries charged until reconciliation.

The application also fails closed when pricing or the durable datastore is unavailable. Do not work around a 503 by bypassing the gateway.

## Suspected provider-key leak

1. Execute emergency AI shutdown.
2. Revoke the affected Groq key. Identify its project/environment from metadata, never from the key value.
3. Inspect Groq project and organization usage, request timing, models, and billing beginning before the suspected exposure time.
4. Create a replacement project-scoped inference key only after project model/rate/spend/funding controls are verified.
5. Store the replacement only in the production server secret store. Keep previews, PR builds, and local shared files excluded.
6. Inspect exposure sources: hosting access/audit logs, CI workflow runs/artifacts/caches, collaborator access, Git history scan, local shell history, screenshots, support tickets, and logs. Redact evidence.
7. Compare provider activity with `ghostwriter_ai_operations` by time, provider request ID, tokens, and cost. Mark ambiguity conservatively; do not lower charged reservations without evidence.
8. Rotate any credential that shared the compromised channel or had equivalent access.
9. Run the full release gate, one controlled smoke test, and only then deliberately set `AI_ENABLED=true`.

## Sudden usage spike

1. Execute emergency AI shutdown.
2. Query counts and sums by operation state, account hash/ID, minute/hour, and rejection reason. Do not query or export prompt/result contents unless the incident strictly requires it.
3. Identify idempotency reuse, account/IP/session patterns, concurrency peaks, uncertain operations, and any operation lacking a prior reservation.
4. Inspect Groq usage and compare model, request count, tokens, and time windows with the internal ledger.
5. Check for alternate deployments, previews, stale keys, branches, old serverless functions, or direct Groq key use outside the application.
6. Determine whether the cause is entitlement farming, proxy misconfiguration, application bypass, credential compromise, provider accounting lag, or expected traffic.
7. Fix the boundary and add a regression/chaos test.
8. Repeat secret scan, unit/security/concurrency/E2E/build checks and a manual ledger invariant review.
9. Re-enable deliberately with reduced external and application limits, then watch the first operations live.

## Budget datastore outage

1. Keep `AI_ENABLED=false`. The gateway already rejects reservation failure with 503 and zero provider calls.
2. Check Supabase availability, connection/pool exhaustion, migration state, RPC grants, statement timeouts, and database logs.
3. Do not switch to in-memory counters, frontend credits, cached balances, or a permissive fallback.
4. After restoration, verify the reservation RPC atomically with mocks/local integration and inspect outstanding operations.
5. Reconcile `reserved`, `dispatched`, and `uncertain` operations before enabling AI.

## Ambiguous provider operation

An operation is ambiguous when the provider may have accepted/billed it but the application lacks a trustworthy settled response.

1. Do not retry the idempotency key or issue replacement credit automatically.
2. Keep the full maximum reservation counted.
3. Search provider records by stored provider request ID when present, time window, and usage metadata.
4. Use `ghostwriter_ai_reconcile_uncertain` only with reviewed evidence and service-role authorization.
5. If a material mismatch cannot be explained, disable AI and escalate as an accounting incident.

## Compromised deployment or service-role credential

1. Disable AI and remove public traffic from the compromised deployment.
2. Revoke `GROQ_API_KEY` to stop direct provider spend.
3. Rotate `SUPABASE_SERVICE_ROLE_KEY`; audit database roles, RLS, function grants, Auth administration, changed rows, new users, and exfiltration paths.
4. Rotate `GHOSTWRITER_SECURITY_SECRET`; expect browser shield, CSRF, artifact tokens, and request fingerprints created with the old secret to stop validating. Existing idempotency records may conflict rather than replay after rotation; do not delete them to restore convenience.
5. Rotate hosting/deployment/CI credentials with access to production secrets, followed by other environment-specific secrets exposed to the same principal.
6. Do not rotate `SUPABASE_PUBLISHABLE_KEY` as if it were confidential; rotate it only if project policy or abuse containment requires it. It is public by design, while authorization remains server/RLS enforced.
7. Rebuild from a reviewed commit and clean dependency install. Verify artifact provenance and deployment audit logs.
8. Restore credentials in least-privilege order while keeping `AI_ENABLED=false`; run all gates before deliberate re-enable.

## Credential rotation order and blast radius

| Name / type | Rotate first when | Blast radius |
| --- | --- | --- |
| `GROQ_API_KEY` | Spend spike, key leak, or compromised runtime | Direct inference spend within Groq project/org controls |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime/admin/data credential exposure | RLS bypass, private data and financial-ledger mutation |
| `GHOSTWRITER_SECURITY_SECRET` | Runtime secret exposure | Browser shield/CSRF/artifact token forgery and request-fingerprint integrity |
| Hosting deploy/API credential | Hosting or CI compromise | Deployment mutation and access to environment secrets |
| Migration/admin database credential, if separately provisioned | DB admin path compromise | Schema, role, and all stored-data control |

Development, staging, preview, CI, and production credentials must be distinct. Never restore a shared credential across environments after an incident.

## Evidence to preserve

- operation IDs/states/timestamps, hashed account/session/IP identifiers, reservation and settled integer amounts;
- provider request IDs, usage totals, project audit/billing events;
- deployment version, commit, environment-name metadata, access/audit events;
- error/rejection codes and timings, without prompt/output/secret/header contents.

Record who disabled and re-enabled AI, when, why, which controls were verified, and which residual uncertainty remains.
