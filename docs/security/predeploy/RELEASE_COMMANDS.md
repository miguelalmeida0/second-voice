# Guarded commands — preparation only

No deployment, production migration, rotation or live inference is authorized by this gate. Existing scripts are reused. Run from /Users/malmeida/Documents/mockup/ghostwritter.

## Local verification (synthetic only)

Use Node22.23.2 from .nvmrc (or the checksum-verified isolated .tmp/toolchain/node-v22.23.2-darwin-arm64/bin runtime). Current npm/network setup may require the system package manager for lockfile installation; runtime tests must record the actual Node version. Do not replace the user's system Node automatically. Run npm ci against the final lockfile, not npm audit fix --force.

```sh
git branch --show-current
git status --short
git diff --check
npx tsc --noEmit
npm run lint
npm run test:security
npm run test:scroll
npm run test:portfolio
node --experimental-strip-types scripts/release/test-auth.mjs --predeploy
npm run verify:portfolio
```

The last two use isolated fixtures and a mocked provider, not a real canary. Required Docker/browser permissions must be granted by the product; never disable guards to bypass sandbox failure.

verify:portfolio now includes --predeploy, scroll and actual isolated retention-cron checks. Its final ignored portfolio-evidence.json binds all source/report files and the build. Do not edit reports afterward without rerunning.

AI-disabled preparation: preflight:deploy requires AI_ENABLED=false, no GROQ_API_KEY, exact GHOSTWRITER_TARGET_ID, GHOSTWRITER_RELEASE_EVIDENCE pointing to the final local artifact, and GHOSTWRITER_DEPLOYMENT_PREPARATION pointing to current target-bound verification (hostingFreePlanVerified, noPaidAddonsVerified, credentialIsolationVerified, privacyApproved, operatorReady). These are recorded checks, not self-authenticating billing proof. This phase does not require a pre-existing deployment/canary. preflight:portfolio remains a separate current-schema/live-policy read-only check; neither command performs deployment or inference.

## Owner operation guard

`scripts/release/operator.mjs` defaults to dry-run. Execution requires --execute, an exact database deployment UUID and either matching PGSERVICE/.pgpass or an explicit management project. Target identity is checked transactionally before mutation. Do not place passwords/receipts/API keys in arguments.

Example safe, non-mutating pause preparation:

```sh
node --experimental-strip-types scripts/release/operator.mjs pause --target=postgres --reason=predeploy-review
```

For production, re-read deployment_id from the exact Supabase project first. Historical ID is not current authorization. No executable command with guessed database UUID, future review date, empty/example project or unverified billing attestation is supplied.

Deletion recovery action is `recover-deletion`, requiring exact --account UUID, --approve=resume-committed-deletion, --database-id, --auth-project and matching --management-project. SUPABASE_URL must equal that project's HTTPS origin and the server credential must be injected privately. It rotates only an incomplete job's receipt hash and attempts one bounded cleanup batch. It does not initiate a new deletion, expose the receipt or reset quota. Retry pending recovery under the same target/job; do not delete ledger rows.

## External release sequence after specific approval

1. Verify Vercel project prj_QigqdvWvfo0tImNgMDonfELF9FIk / team team_yiVtxHRnCt6hDEzgVpYMjlBz, Supabase oycnkdlmdhfhmuuyfyqt, exact database deployment_id and current migration history.
2. Approve and back up before forward migrations 202609080001–005; keep independent AI kill switch off. Install and verify retention maintenance as described in RETENTION_FOLLOWUP.md. Public lookup revocation affects old shares; old runtime RPCs will fail closed.
3. Deploy only the reviewed artifact with AI_ENABLED=false, fixtures/email/public sharing disabled and no inference key exposed to previews. Use the existing authenticated deployment tooling after verifying its project link; do not publish this work under a different project.
4. Verify HTTPS/headers, actual GitHub PKCE flow, reachable approved privacy/contact, ingress IP replacement, runtime versions, environment isolation and deletion on an explicitly approved disposable target identity.
5. Only after genuine Free key/project/plan evidence and all canary gates close, authorize one operation plus identical replay for Groq project project_01kpvdq6b7fjxrq47rtdke18p7. Keep original limits; no new dates/attestations invented to unlock it.
6. Inspect provider/ledger counts, pause and review. Limited-beta admission requires another deliberate owner decision.

These are gated procedures, not claims that the external actions were tested or executed.
