# External security assumptions

Point-in-time verification date: 2026-09-07. These facts are configuration inputs, not substitutes for repository enforcement.

## Groq

| Assumption | Verified fact / conservative treatment | First-party source |
| --- | --- | --- |
| Model pricing | `openai/gpt-oss-20b`: $0.075 per million normal input tokens and $0.30 per million output tokens. Cached input is cheaper, but the app reserves normal-input pricing. | [Model page](https://console.groq.com/docs/model/openai/gpt-oss-20b) |
| Model token capacity | Provider capacity is much larger than this app’s limits; the server independently caps both input and output at 2,000. | [Model page](https://console.groq.com/docs/model/openai/gpt-oss-20b) |
| Output parameter | `max_completion_tokens` is the current field; `max_tokens` is deprecated. | [API reference](https://console.groq.com/docs/api-reference) |
| Reasoning | Reasoning is bounded by the completion budget for the selected model; the app requests low reasoning effort and does not expose reasoning. All completion usage must remain within the 2,000-token reservation. | [Reasoning guide](https://console.groq.com/docs/reasoning) |
| Usage accounting | Responses provide prompt and completion token usage. Missing/malformed/out-of-bounds usage causes an uncertain, fully reserved operation. | [Prompt caching and usage](https://console.groq.com/docs/prompt-caching) |
| Rate limits | Limits are organization-level unless project controls are configured. The app does not depend on them for correctness. | [Rate limits](https://console.groq.com/docs/rate-limits), [Projects](https://console.groq.com/docs/projects) |
| Spend limit | Groq documents a roughly 10–15 minute update delay and possible overshoot. It is not treated as an instantaneous hard cap. | [Spend limits](https://console.groq.com/docs/spend-limits) |
| Automatic retries | The app uses native `fetch` exactly once and no provider SDK, queue, or retry wrapper. No provider-side request retry behavior is assumed. | Repository enforcement |

Pricing is version-pinned in configuration as `groq-openai-gpt-oss-20b-2026-09-07`. A price/model change requires a reviewed code/config update. Unknown pricing disables AI.

## Supabase

- Supabase Auth is assumed to validate bearer access tokens through `auth.getUser`, not through client-provided user IDs.
- Email verification is determined from the server-returned Auth user. Closed-beta signup/invite/email throttles are dashboard configuration and remain unverified.
- PostgreSQL transactions, row locks, unique constraints, and transaction advisory locks are assumed to provide their documented atomicity. The migration uses a global advisory transaction lock to serialize the small beta admission path.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and is therefore a high-impact server-only credential. The runtime currently needs it for controlled RPCs and private persistence; it must never enter the client or previews.
- No production database state, backups, pool limits, PITR setting, network restriction, or migration application was inspected from this repository.

## Hosting and reverse proxy

- The repository does not identify the production hosting vendor, domains, CDN, or exact proxy chain.
- `GHOSTWRITER_TRUST_PROXY=true` is safe only when the selected `GHOSTWRITER_CLIENT_IP_HEADER` is overwritten by the actual trusted edge and cannot be supplied unchanged by the public client.
- The application does not treat IP as identity, entitlement, or budget authority. Misconfiguration weakens secondary rate limits but cannot raise the global financial budgets.
- Preview secrets, production-only environment scoping, request/invocation hard limits, WAF controls, and bandwidth/serverless spending controls are external and unverified.
- `productionBrowserSourceMaps=false` is explicit, while the primary protection remains that provider/service credentials never enter browser code.

## Supply chain and CI

- GitHub Actions references are pinned to immutable commits. `npm ci` consumes the committed lockfile.
- Gitleaks v8.30.1 is pinned in the current audit procedure; its Docker image resolved to digest `sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f` during verification.
- Secret scanning found only three reviewed synthetic historical fixtures, ignored by exact finding fingerprints. This does not prove that credentials were never exposed outside Git.
- Fork/PR production-secret availability depends on repository/hosting settings. The checked-in workflow itself does not request production provider or service-role secrets.

## Revalidation triggers

Repeat external verification before enabling AI and whenever any of these changes:

- provider/model/pricing or token accounting;
- Groq project, billing, funding, team, key, or rate-limit settings;
- hosting vendor, proxy/CDN, domain, preview, or secret scope;
- Supabase project, Auth policy, database role/grant, migration, or pooling configuration;
- dependency lockfile or CI action revisions.
