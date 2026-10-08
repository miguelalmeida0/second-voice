# Second Voice

**A writing studio for reshaping a draft by voice, tone and intended outcome without losing the original.**

[Open the application](https://secondvoice-ai.vercel.app/second-voice) · [Engineering documentation](docs/README.md) · [Security gate](docs/security/LAUNCH_GATE.md) · [Contributing](CONTRIBUTING.md)

Second Voice separates the source draft from its rewrite, with authored quick starts, author/outcome choices, and a rewrite workspace. The product is implemented in Next.js 16, React 19 and TypeScript.

> **Release boundary:** The interface is available for inspection; owner-funded inference is disabled by default. Live generation is not production-approved until the authentication, abuse-control, provider and financial launch gates are demonstrated. See [deployment readiness](docs/security/DEPLOYMENT_READINESS.md). A working sample or build is not evidence of paid inference readiness.

## Engineering overview

| Area | Responsibility |
| --- | --- |
| `src/app/` | Next.js routes, pages and server endpoints |
| `src/components/ghostwriter/` | Writing studio and interaction surfaces |
| `src/server/` | Server-side authentication, provider and policy boundaries |
| `src/lib/` | Shared utilities and client contracts |
| `supabase/migrations/` | Durable database migrations and access boundaries |
| `tests/` | Security, UI, release and browser regression coverage |
| `scripts/release/` | Production preflight and release verification |
| `docs/` | Architecture, release evidence, operational and security records |

## Develop locally

Requires Node.js 22 (see `.nvmrc`). Keep AI disabled unless you are explicitly exercising the guarded provider flow.

```bash
npm ci
npm run dev
```

Use [`.env.example`](.env.example) for variable names and safe defaults. **Never commit real secrets.** A local interface is not equivalent to a released generation gateway.

## Verify

```bash
npm run lint
npx tsc --noEmit
npm run test:unit
npm run test:security
npm run test:scroll
npm run security:check
npm run verify:release
```

Local `npm run security:check` reads `.env.local`. CI runs `npm run security:check` with explicit production environment variables.

Integration and end-to-end tests have additional runtime prerequisites; follow the [technical reference](docs/security/TECHNICAL_REFERENCE.md) rather than inferring coverage from a partial run. Do not enable paid inference based solely on passing local checks.

## Documentation

- [Documentation index](docs/README.md) — current product, operations, tests and historical records
- [Technical reference](docs/security/TECHNICAL_REFERENCE.md) — environment variables, abuse-store operations, verification and release state
- [Security and responsible disclosure](SECURITY.md)
- [Release notes archive](docs/releases/README.md) — versions 7–17, preserved verbatim
- [Visual QA evidence](docs/quality/design-qa.md) — retained historical acceptance record

Development happens on `test`; only validated changes reach `main`. See [`AGENTS.md`](AGENTS.md) for the repository's two-branch policy.
