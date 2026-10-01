# Remaining owner actions

For the current Free-only portfolio deployment, follow [PORTFOLIO_RELEASE.md](PORTFOLIO_RELEASE.md). The paid-SaaS sequence below is deferred and does not require paid certification for a genuinely verified Free-only deployment.

No target hosting/CDN or production Supabase/Groq project identity was established from repository configuration. Do not substitute a guessed Vercel/Cloudflare target. No production changes are authorized by the implementation request.

1. Establish the exact deployment, Supabase project/database, Groq organization/project, domains, current credentials' environments, and other apps sharing billing. Record metadata only.
2. Review the continuation diff and local evidence. Permit the owner to create security/ghostwritter-deployment-ready and commit after required checks pass; this session cannot write .git.
3. Complete the provider full-input/framing/reasoning accounting proof and local integrated release gaps before considering live transport.
4. Confirm separate runtime/migration/operator/CI/preview credentials and separate test/production projects. Review service-role blast radius. Rotate real credentials only with explicit authorization and dependency/rollback plan; never paste them into chat.
5. Configure Supabase invite-only provisioning, verified email, code email template (Token variable), finite invitation controls, Auth rate limits and session/logout policy. Public direct Auth signup must be disabled, not just hidden by the UI. App sign-in does not grant entitlement.
6. With explicit production migration authorization and AI disabled outside the database, apply existing migrations then 202609070002 and 202609070003. Verify ownership, exact grants, function overloads, auth.sessions schema compatibility, backups and preserved liabilities. No reset/financial-history rollback.
7. Deploy the reviewed AI-disabled build only after explicit authorization. Verify trusted-proxy header from the actual ingress, domain allowlists, cookies/CSP, no production secrets in previews, release/schema versions and source/build evidence.
8. Configure provider controls and record console evidence. Then configure infrastructure controls below. Attestations are not automated verification.
9. Provision only the owner with the dry-run operator command first. Prepare one immutable canary run with AI paused. Run preflight:deploy and preflight:enable-ai; both must pass before any explicit live-call approval. They currently block.
10. Only after a separate one-call authorization: enable the reviewed owner-only canary configuration through the normal gateway, reuse the same run key for replay, reconcile usage, and demonstrate pause. On ambiguity remain paused; never start a new run to try again.
11. After evidence-based reconciliation and fresh approval, consider at most five named testers. Never auto-replenish lifetime credit or recycle slots.

## Provider evidence reviewed 2026-09-07

Groq spend limits apply organization-wide across keys/apps, require eligible paid-tier owner access, track with a 10–15 minute delay, reset monthly, and allow in-flight requests to finish. They are not a strict per-project lifetime cap. Do not upgrade a plan to obtain them without authorization. Account tier/available controls are unknown.
https://console.groq.com/docs/spend-limits

Use project-level Only Allow for openai/gpt-oss-20b, subject to the organization allowlist. A project cannot override an organization block. Actual console setting is unverified.
https://console.groq.com/docs/model-permissions

Do not assume inference-only key scopes, automatic reload controls, prepaid hard cutoffs, or per-project billing caps exist. Confirm supported controls in the actual account. A stolen provider key bypasses the app ledger; provider denial/key revocation is an independent emergency action. Changes to organization controls may affect other apps and need explicit approval.

Supabase documents that revoked access tokens remain valid until expiry; app spending therefore also checks durable session revocation:
https://supabase.com/docs/guides/auth/signout
Privileged key and SQL guidance:
https://supabase.com/docs/guides/getting-started/api-keys
https://supabase.com/docs/guides/database/functions

## Billable-service inventory to complete

| Service | Units/exposure requiring confirmation | Current control evidence |
|---|---|---|
| Groq | All billable input/output/reasoning, shared org spend, delayed cutoff | Published docs only; account unverified |
| Hosting/CDN | Invocation/CPU, memory, requests, bandwidth, image transformation, builds | Actual vendor/plan unknown; unbounded/unverified by this control |
| Supabase | Database compute/storage/egress, Auth users/email, backups | Actual plan/project unknown; unbounded/unverified by this control |
| Email/SMTP | Verification/invitation/recovery deliveries and overage | Provider unknown; unbounded/unverified by this control |
| Logs/monitoring | Ingestion, retention, cardinality, alerts | Sink/plan unknown; unbounded/unverified by this control |
| CI/DNS/storage | Runner minutes, artifacts, DNS plan, retained media | Account arrangements unknown; unbounded/unverified by this control |

For each confirm cap/alert versus enforced cutoff, enforcement delay, automatic overage/funding, exclusions, and emergency disable procedure. The app's $10 ledger is not a total infrastructure invoice ceiling.

## Exact local commands

From /Users/malmeida/Documents/mockup/ghostwritter:

- npm run dev (http://127.0.0.1:4003/second-voice; paid transport remains disabled)
- npm run verify:release
- npm run preflight:deploy
- npm run preflight:enable-ai
- node scripts/release/operator.mjs pause --target=REVIEWED_DATABASE --reason=owner_requested_pause
- node scripts/release/operator.mjs grant --target=REVIEWED_DATABASE --account=REVIEWED_UUID --slot=1 --reason=owner_only
- node scripts/release/operator.mjs prepare-canary --target=REVIEWED_DATABASE --account=REVIEWED_UUID --run=FIXED_RUN_UUID --reason=owner_canary

Operator commands are dry-run unless --execute is added by an authorized owner. Execution additionally requires --service matching PGSERVICE and --database-id matching the durable deployment UUID, checked inside the mutation transaction. Use a restricted PGSERVICE and protected .pgpass; do not place credentials in shell arguments. No resume command is supplied while the provider bound remains unresolved.


The one-operation harness is prepared as:
node scripts/release/canary.mjs --target=https://REVIEWED_HOST/ --account=OWNER_UUID --run=FIXED_RUN_UUID

It is dry-run by default. Live execution additionally requires passed enablement preflight, explicit --approve=one-operation --execute, matching operator pause target metadata and an ephemeral owner token supplied securely to the process. Do not execute it while the current gates are blocked. The matching durable canary row must already exist; preparing a conflicting/repeated canary fails rather than silently substituting another run.
