# Security setup

This document is the full local + CI reference for how `npm run security:check`
behaves. The [README](../README.md) keeps a short summary; this page is the
source of truth the automated tests validate against.

## Local development

- Copy your provider/service credentials into a `.env.local` file at the repo
  root. This file is git-ignored and never committed.
- `npm run security:check` (via `scripts/security-check.mjs`) loads
  `.env.local` automatically whenever `NODE_ENV` is not `production`, so local
  runs pick up your keys without exporting them into the shell.
- Values read from `.env.local` are never printed. The script only reports
  which variables are missing or fail validation, not their contents.
- Locally you can leave optional variables unset (for example
  `GHOSTWRITER_ABUSE_STORE_MODE=memory`) — the script only enforces the
  hardened rules described below when `NODE_ENV=production`.

## CI behavior

- CI does not rely on `.env.local`. `scripts/security-check.mjs` skips
  loading that file entirely when `NODE_ENV=production`, so the workflow must
  supply every required variable explicitly.
- `.github/workflows/security.yml` runs `npm run security:check` with
  `NODE_ENV: production` and an explicit, production-style environment
  (placeholder credentials, not real secrets) covering the AI provider,
  Supabase abuse store, session secret, and site URL.
- Production configuration fails closed: if a required variable is absent or
  weak (a short/placeholder `GHOSTWRITER_SECURITY_SECRET`, an in-memory abuse
  store, a missing Supabase URL/service-role key, an insecure site URL, etc.),
  the script exits non-zero and the workflow fails instead of silently
  falling back to an insecure default.

## Durable abuse protection

- Production must set `GHOSTWRITER_ABUSE_STORE_MODE=supabase`. The in-memory
  mode is rejected in production because it does not survive multiple
  serverless instances or restarts.
- The Supabase-backed store additionally requires `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` to be present; the script fails if either is
  missing.

## Verification commands

```bash
npm run security:check      # uses .env.local locally, explicit env vars in CI
npm run test:release:gate   # lint + typecheck + security + scroll tests
npm run test:security       # unit tests for scripts/security-check.mjs behavior
npm run build -- --webpack
npm audit --audit-level=moderate
```

See `tests/security-env.test.ts` for the executable contract these commands
must satisfy.
