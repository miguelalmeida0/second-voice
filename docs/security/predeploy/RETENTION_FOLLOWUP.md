# Retention and recovery follow-up — 8 September 2026

This supersedes earlier claims that owner contact/retention decisions, pre-dispatch termination, and real Storage failure tests are missing. It does not authorize deployment or establish hosted readiness.

## Approved facts and implementation

Public operator: Miguel; contact: miguelalmeida1592@gmail.com; personal portfolio. No business identity or home address invented or published. The approved policy is seven-day private content expiry and 90-day minimal recovery records with permanent trial retirement before allowance records are purged. `/second-voice/privacy` is linked before sign-in and from help/account deletion. Provider arrangements and jurisdiction-specific identification still need verification; this is not a legal-compliance certificate.

Migration `202609080005_ghostwriter_retention.sql` adds an owner-only bounded executor, monotonic lifecycle, read-time expiry on current and legacy replay RPCs, late-write redaction, and retirement fencing for enrollment/admission/dispatch. No maintenance heartbeat for two hours fails admission closed. Settlement remains possible without restoring expired text. Runtime roles cannot run maintenance or reset lifecycle/accounting.

Retirement is 90 days after migration initialization, not first use. Each account-linked record must also reach its own 90-day age. Cleanup processes at most 100 rows per category/run. Unresolved liabilities and incomplete deletion jobs block operation purge until reconciled. Auth revocation fences survive while their referenced identities/sessions exist. These exceptions require operator follow-through, not indefinite unattended retention. Nonpersonal start/cost aggregates survive. Legacy public artifacts are not assigned guessed owners or mass-deleted.

## Local evidence

- PostgreSQL integration and portfolio suites: bounded batches, idempotence, immutable starts/costs, late-write redaction, role denial, unresolved-liability hold, permanent retirement and legacy replay expiry.
- Actual pg_cron worker executed maintenance in pinned isolated Supabase PostgreSQL 17. Accelerated one-second execution was tested; the five-minute deployment schedule was then installed/read back. No hosted job created.
- Two production Next workers: termination before/after dispatch, ambiguous commits, provider failure modes and recovery.
- Real Supabase Storage/file backend: outage, successful deletion with lost response, resumed cleanup and both blob downloads denied afterward. Test user/admin clients are separate; no RLS policy relaxed.
- Production browser: Auth outage preserves draft, all Authors/Outcomes selections and desktop/tablet/mobile native scrolling. Screenshots inspected at 1440 and 390 pixels.
- Fresh security review found the legacy replay path and default paid-fixture isolation regression; both corrected and integration-tested.

Latest final verifier results are recorded in EVIDENCE.json when complete. Historical verifier hashes do not identify this candidate.

## External acceptance remains open

Five migrations are not applied to hosted Supabase. Scheduler installation requires reviewed pg_cron availability, exact target, explicit execution approval and successful heartbeat. Keep AI independently disabled during coordinated schema/runtime rollout: old RPC grants are revoked.

Groq needs authenticated evidence of exact Free organization/key/project, data controls and token accounting. Sign in to the existing console project; never send credentials in chat. Supabase plan/add-ons, owner MFA/recovery, processor/transfer arrangements, old deployment isolation, ingress/runtime verification, monitored alerts and operational backup/restore remain target requirements. Local synthetic evidence cannot replace them.

No deployment, hosted migration/deletion, rotation, external message or live inference performed.

## Additional checks and rollout amendment

```sh
node scripts/release/test-retention-cron.mjs
npm run test:integration
npm run test:portfolio
node --experimental-strip-types scripts/release/test-auth.mjs --predeploy
npm run verify:portfolio
```

After explicit hosted approval include migrations 202609080001–005. The guarded `schedule-maintenance` operator action requires `--approve=seven-day-content-ninety-day-trial`, exact deployment identity and explicit execution; dry-run is the default. Enable reviewed pg_cron first. Confirm job success and heartbeat before AI activation. A schedule row alone is not execution proof.
