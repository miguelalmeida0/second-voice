# Duet functional parity verification — 2026-10-04

Scope: the current dirty `design/duet-responsive` branch, compared with base `2c9abc01b4cdd7e2b82417573e3cd6c3473249a0`. Existing redesign and action-layout work was preserved. Used Superpowers systematic debugging, verification before completion, and an independent read-only code review. No merge or deployment.

## Findings and fixes

1. **Stale clipboard failure:** a failed Copy message remained after a subsequent successful rewrite. A browser regression reproduced this before the fix. Clipboard failure state now belongs to its result's `runId`; an old or delayed failure cannot label a newer result as failed.
2. **Quick starts disclosure parity:** splitting prompts and actions into two components disconnected their disclosure state. Rewrite no longer closed an open prompt list. A browser regression reproduced this before the fix. Parent-owned disclosure state restores the previous behavior and preserves the selected sample.
3. **Stale test harness:** the independent combined-cap fixture stopped at its migration guard because its list omitted the repository's existing `202609160003` dispatch-entitlement correction. Read the migration and included it in the fixture's ordered forward-migration list. The newest-migration guard remains. All 14 scenarios then passed; no application rule or migration changed.

The independent reviewer checked the fixes and found no remaining concrete functional regression in the reviewed frontend diff. A suspected dock oscillation at intermediate enlarged text was investigated but not reproduced; it is not reported as a bug.

## Feature coverage

| Feature | Verification |
| --- | --- |
| Composer | Empty/whitespace validation, 2000-character limit, long/multiline text, Unicode payload, original whitespace retained in editor, resizing and selection preservation |
| Authors and mood | All four authors submit their canonical IDs at mood 0 and 100; controls alone send zero generation requests |
| Outcomes | All five outcomes submit their canonical IDs; mode/selection persist across reload; invalid stored preferences fall back safely |
| Quick starts and Surprise | All six real samples, selected sample retained, disclosure collapse restored, Surprise submission and result behavior |
| Rewrite lifecycle | Ready/pending/completed labels, one primary, unforced clicks/taps, duplicate suppression, unique idempotency keys, playback/skip, another rewrite |
| Failure/retry | Model failure, provider 429/500/disconnect/malformed/missing usage/timeout, no automatic retry, draft preservation and explicit retry |
| Copy/share | Copy success, clipboard denial and fallback failure, truthful status, keyboard focus restoration, new-result error isolation, share confirmation/cancel/retry, created link survives clipboard denial without another share request |
| Optional features | Feedback failure recovery, Rewrite Lab candidates/scores/trace/winner/provenance, invalid permalink recovery; enabled in isolated E2E only where feature flags permit |
| Auth/session | Actual isolated GoTrue/PostgREST/PostgreSQL and Next browser email-code sign-in/logout, refresh races, HttpOnly cookies, token/OTP replay rejection, suspension, entitlement revocation, exhausted-allowance logout |
| Allowance and financial boundary | Anonymous/authenticated allowance, concurrent dispatch admission, idempotent replay, 100 mixed-identity attempts at 59/60 capacity, stale snapshots, failure accounting, no reset on deletion/retention |
| Account lifecycle | Production-route deletion, recent-auth enforcement, partial Auth/Storage failures and recovery, blob erasure, synthetic encrypted backup restore, real isolated pg_cron retention execution |
| Responsive/accessibility | Five browser projects, requested eight sizes plus existing matrix/breakpoints, 320–2560px sweep, initial viewport CTA, focus clearance, long results, short viewport fallback, enlarged root text, reduced motion, axe and native document scroll |
| Navigation | Canonical/legacy routes, help modal focus/inert/Escape, account and legal surfaces, case study and recovery links |

## Fresh execution results

All commands use Node 22.23.2. Logs are local under `.tmp/duet-deep-*.log`.

| Command | Result | Log suffix |
| --- | --- | --- |
| `npm run test:security` | PASS 207/207 after fixes | `security` |
| `npm run test:scroll` | PASS 22/22 after fixes | `scroll` |
| `npm run lint` | PASS; zero errors, three existing warnings | `lint` |
| `npx tsc --noEmit` | PASS | `types` |
| `GHOSTWRITER_NEXT_DIST_DIR=.tmp/next-duet-deep-build npm run build` | PASS | `build` |
| `npm run test:portfolio` | PASS; three SQL/gateway/retention scenarios | `ledger` |
| `npm run test:integration` | PASS legacy ledger/gateway and retention proof with isolated PostgreSQL | `legacy-ledger` |
| `node scripts/release/test-combined-ai-cap.mjs` | PASS 14/14 scenarios, independent connections, 100 concurrent attempts | `cap` |
| `node --experimental-strip-types scripts/release/test-auth.mjs` | PASS HTTP and actual browser authentication | `auth` |
| `node --experimental-strip-types scripts/release/test-auth.mjs --predeploy` | PASS 24 production integration evidence entries | `production` |
| `node scripts/release/test-retention-cron.mjs` | PASS actual isolated scheduled execution | `retention` |
| `GHOSTWRITER_NEXT_DIST_DIR=.tmp/next-duet-deep-build node scripts/release/test-portfolio-browser.mjs` | PASS production-rendered UI at 10 viewport sizes; zero live provider calls | `portfolio-ui` |
| `npm run test:e2e -- --workers=2` | PASS 235/235, five browser projects, 6.8 minutes, zero failures | `full` |

All final commands above exited zero. The full suite includes the four new parity tests across desktop Chromium, Firefox, WebKit, iPhone 13 WebKit and Pixel 7 Chromium. `git diff --check` also passed. The isolated build's automatically added TypeScript include paths were removed after the build; the user's normal development configuration remains intact.

## Evidence boundaries

- The E2E suite uses intercepted generation responses. Production integration uses actual local services and a synthetic provider. No live model calls, real account deletion, or live database mutations were made by this verification. The user's current browser draft and allowance were left intact.
- Optional sharing, feedback and Rewrite Lab are tested in their enabled fixture profile. The production portfolio profile intentionally denies unavailable optional routes; tests cover that boundary too.
- Live external OAuth completion, email delivery, paid billing, and live model quality were not established by these tests. Browser OTP proof obtains a synthetic code from isolated GoTrue rather than sending email.
- Phone projects are browser emulation, not physical devices. Enlarged root text and visual-viewport checks do not prove every OS zoom or real virtual-keyboard behavior.
- This is functional verification, not a fresh passing assertion for the broader release aggregate, dependency audit, hosted configuration or deployment readiness. Earlier release limitations remain documented in `DUET-REPORT.md`.
- Intermediate failures were preserved: stale-copy and disclosure tests failed before fixes; the first clipboard test had an ambiguous Next route-announcer locator, then a Safari pointer-focus assumption corrected to keyboard activation. The sandbox initially blocked browser bootstrap; the isolated auth rerun passed with browser permission. None of these intermediate attempts is counted as a pass.

Screenshots from the full responsive suite remain under `artifacts/duet-action/after/`; before screenshots remain under `artifacts/duet-action/before/`. Production UI evidence is under `.tmp/release/portfolio-ui/`. Mobile bottom-of-page evidence was visually checked: final links clear the action dock, with no forbidden horizontal thumb.
