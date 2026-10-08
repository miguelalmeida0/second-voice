# Security

**Current posture:** Owner-funded AI generation is disabled by default. The implementation is **not approved for public paid-inference launch** without satisfying [the launch gate](docs/security/LAUNCH_GATE.md).

Report suspected vulnerabilities privately using [the maintainer contact page](https://miguelalmeida.xyz/#contact). Do not publish credentials, customer text, session tokens or exploit payloads in public issues.

## Boundaries

- Provider API keys, financial budgets and Supabase service credentials belong on the server. Never expose them as `NEXT_PUBLIC_*` variables.
- Production generation requires authenticated entitlement, durable idempotency and atomic budget reservation. A client switch is not authorization.
- Security, scroll integrity and database migration checks are release gates, not optional formatting checks.
- A green local test suite does not certify provider billing, reverse-proxy trust, production configuration or operational incident recovery.

See [technical configuration and verification](docs/security/TECHNICAL_REFERENCE.md), [deployment readiness](docs/security/DEPLOYMENT_READINESS.md) and [`.env.example`](.env.example) for non-secret variable names. Rotate any exposed credential immediately; Git history edits alone cannot revoke a secret.
