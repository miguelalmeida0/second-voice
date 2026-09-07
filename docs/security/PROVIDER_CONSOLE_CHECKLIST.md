# Groq production console checklist

This checklist is manual and blocking. The repository did not change any provider account, credential, limit, funding, or billing setting. Record screenshots or change-ticket evidence without exposing secret values.

Verified against first-party documentation on 2026-09-07:

- [Groq model and pricing: `openai/gpt-oss-20b`](https://console.groq.com/docs/model/openai/gpt-oss-20b)
- [Groq organization rate limits](https://console.groq.com/docs/rate-limits)
- [Groq spend limits](https://console.groq.com/docs/spend-limits)
- [Groq projects and project limits](https://console.groq.com/docs/projects)

## Before creating the production key

- [ ] Create a dedicated **Ghostwritter production** Groq project. Do not reuse a personal, development, staging, CI, or unrelated-product project.
- [ ] Create separate development/staging projects and credentials if those environments need real-provider smoke tests.
- [ ] Ensure preview deployments receive no production Groq key. Prefer `AI_ENABLED=false` and no provider credential at all.
- [ ] Confirm the production runtime credential cannot create keys, administer the organization, change billing, or manage unrelated projects. The app only needs inference access.
- [ ] Verify the project is restricted to the intended team members and remove stale collaborators.

## Model and throughput controls

- [ ] Confirm `openai/gpt-oss-20b` is available and remains the only application-approved model.
- [ ] Where the console supports model-specific restrictions, allow only `openai/gpt-oss-20b` for this project/key.
- [ ] Set the project rate limit to the lowest practical ceiling at or below 10 requests/minute and 2 concurrent requests if those controls are available. Provider limits are defense in depth; the PostgreSQL gate is authoritative.
- [ ] Do not enable batch, tool use, web search, compound systems, fine-tuning, or other separately billable products for this credential.
- [ ] Confirm the provider key is stored only as the production server secret named `GROQ_API_KEY`.

## Spend and funding controls

- [ ] Open **Settings -> Billing -> Limits** and configure the smallest organization monthly spend limit compatible with the $10 lifetime beta plan.
- [ ] Treat the provider spend limit as delayed defense in depth, not the application’s instantaneous hard cap. Groq documents a 10–15 minute propagation delay and possible overshoot.
- [ ] Disable auto-reload, automatic balance replenishment, and automatic funding wherever the account/billing method exposes them. If the account cannot disable them, document the exact residual maximum and keep AI off until Miguel accepts it.
- [ ] Configure billing/usage alerts at approximately 50%, 80%, and 100% of the intended beta envelope, plus an unusual-rate alert if available.
- [ ] Confirm alert recipients include Miguel and a monitored backup address.
- [ ] Record whether the spend limit is organization-wide or project-specific. Do not assume a project limit caps unrelated organization usage.

## Credential issuance and rotation

- [ ] Issue a new, dedicated production key only after the project controls above are set.
- [ ] Store it in the production hosting secret store. Never place it in `.env.example`, CI variables used by pull requests, preview secrets, source, logs, screenshots, or client-prefixed variables.
- [ ] Rotate any current key that predates this hardening review, was reused across environments, or was ever copied through an untrusted channel.
- [ ] Revoke superseded keys after the replacement deployment is verified with `AI_ENABLED=false`.
- [ ] Enable AI deliberately only after every launch-gate P0 is closed.

## Controlled smoke test

Only after mock tests and all launch blockers pass:

1. Use one approved staging/test account and one fresh idempotency key.
2. Set the production-like environment with `AI_ENABLED=false`; verify provider calls remain zero.
3. Enable AI for the isolated controlled environment.
4. Execute one short rewrite.
5. Verify exactly one Groq request, the fixed model, usage fields, one internal settled operation, and expected micro-USD cost.
6. Disable AI again until the launch decision is signed off.

Do not run concurrency, chaos, or retry tests against the real provider.
