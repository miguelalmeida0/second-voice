# Secret and SDK inventory

Current gate15September2026. Prior dated scan statements below are historical; fresh redacted scanner/client-canary outcomes are in the final .tmp/release/portfolio-evidence.json. Vercel selected account access currently denied; Groq billing currently signed out. No current credential rotation, private-key retrieval or live usage performed. Historical unused Groq-key revocation is recorded in GROQ_ACCOUNT_CHECK.md, not repeated here.

Never include values, cookie jars, raw HAR, dumps, provider responses or OAuth URLs in public evidence.

| Name/category | Purpose / consumer | Owner and rotation effect |
| --- | --- | --- |
| GROQ_API_KEY | Server ai-provider only | Dedicated verified Free Groq project required; revoke if exposed, reconcile dispatched operations; no retries |
| SUPABASE_SERVICE_ROLE_KEY | Server Auth/admin/Storage and restricted PostgREST RPCs | Supabase project owner; broad Auth administration is still sensitive; DB operator powers revoked from runtime |
| SUPABASE_PUBLISHABLE_KEY | Public credential class, used by server Auth client here | Not authorization; RLS/grants remain necessary |
| SUPABASE_URL | Public project destination | Must match approved project; never client-selected |
| GHOSTWRITER_SECURITY_SECRET | HKDF-separated shield, CSRF, challenge, artifact and OAuth signing | Root rotation invalidates transient capabilities; must not recycle trials |
| GHOSTWRITER_FINGERPRINT_SECRET | Stable canonical operation request digest | Separate root; rotation causes safe replay conflicts, not history deletion/refunds |
| GitHub OAuth secret | Supabase-hosted provider integration | Owner/project check pending; not present in browser app code |
| Access/refresh cookies | HttpOnly session capability; Secure/__Host in production | Server verifies signature/issuer/audience/expiry/user/session; durable logout fence; cross-tab reload clears client state |
| PKCE cookie | Signed verifier, ten-minute expiry | No bearer Auth authority; callback additionally validates Supabase exchange |
| Deletion receipt cookie | Seven-day capability only to continue an existing deletion | Hash stored; operator can renew after loss; never authenticates or selects another account |
| PGSERVICE/.pgpass / management CLI login | Owner-only deployment-bound SQL | Separate from runtime; never passwords in command arguments |
| Vercel / GitHub / Supabase CLI tokens | Read-only metadata verification or separately approved release operation | Scope/MFA/recovery unverified; values never reported |

Git history scan initially found no leaks. A working-tree scanner finding was a literal synthetic test signing string; replaced with per-test random material instead of adding a broad ignore. Final scanner status is in EVIDENCE.json. No real exposed credential was identified by that finding.

Runtime SDKs: Next/React, Supabase JS, Zod, Framer Motion, Lucide. Build/test: TypeScript, ESLint, Tailwind, Playwright/axe, pinned Docker test images and gitleaks. No Stripe, analytics/replay SDK, payment flow or mobile package discovered. GitHub Actions use immutable action SHAs with contents:read; hosted branch protections and collaborator permissions are not proven by YAML. No fork pull_request_target execution found.

Fonts are bundled by Next at build; portraits/mascot are local public assets. Portrait attribution remains accessible in How it works. Licensing/AI-colorization provenance must be approved by the owner, not inferred from successful image loading. Runtime browser destination checks must be compared with same-origin app/static, GitHub→Supabase OAuth and server-only Groq destinations.

The supplied GHOSTWRITTER_ELITE_DESIGN_HANDOFF_2026-09-08.zip Markdown members were separately streamed to pinned offline gitleaks on 2026-09-08: 21,328 bytes, no finding. Nothing was extracted or executed. Raster images were not OCR-scanned; this is not exhaustive archive certification.

Coverage limits: historical private screenshots/logs were not exhaustively scanned. Local ignored environment files were not printed or copied into synthetic test apps. Build canary checks cover known synthetic secret markers, not every possible historical credential. Keep .env, dumps and handoff credentials out of public/deployment assets.
