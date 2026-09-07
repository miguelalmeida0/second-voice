# Infrastructure cost bounds

The $10 lifetime value is an **AI application-ledger boundary only**. It is not a total-loss guarantee because hosting, database, email, bandwidth, logs, DNS/CDN, and provider-account behavior have not been observed or capped from this repository.

## Cost inventory

| Service | Billing dimension / abuse path | Repository boundary | External hard limit known? | Alert / overage risk | Shutdown mechanism |
| --- | --- | --- | --- | --- | --- |
| Groq inference | Input/output tokens; request storms; abandoned requests | 750 micro-USD max reservation per admitted request; $0.50/hour, $2/rolling 24h, $10 beta lifetime; 10 starts/min; 2 active; zero retries | Provider spend controls exist but are delayed and can overshoot; actual account setting unknown | Billing alerts must be configured; automatic funding state unknown | Set production `AI_ENABLED=false`, deploy/restart config, then revoke key if needed |
| Application hosting/serverless | Requests, CPU duration, memory, build minutes, bandwidth | 10,000-byte state-changing body cap, cheap header/schema rejection, ingress rate limits, no unbounded queue/background job | Unknown until host/plan is identified | Automatic overage may be possible | Disable deployment/domain, apply edge/WAF limits, or scale-to-zero per provider runbook |
| Supabase PostgreSQL/Auth | Database compute/storage/egress; RPC floods; auth/verification/reset email | Indexed bounded lookups, durable rate limits, strict statement timeout on financial reservation, no anonymous base-table scans, finite result payload | Project/plan limits unknown | Compute/storage/email overage and exhaustion may be possible | Keep AI off; pause/restrict project or credentials according to Supabase plan/runbook |
| Auth email provider (through Supabase) | Signup, verification, password reset spam | No application signup/reset UI was found; live beta auth UX remains a blocker | Dashboard controls unknown | Email quota/cost and reputation exposure unknown | Invite-only Auth, dashboard email throttles/CAPTCHA, disable affected flows |
| Logs / telemetry | Repetitive rejection/error events and retention | Metadata-only structured events, hashed identifiers, no prompt/output/header dumps; no paid collector configured in source | N/A in repository | Hosting log retention/ingestion can still cost money | Reduce/suppress noisy class at collector, set quotas/retention, disable export |
| Public artifact storage/egress | Shared page enumeration, database rows, OG image requests | Sharing disabled for closed beta; short signed artifact provenance; bounded short-ID RPC; no source by default | Host/database limits unknown | If sharing is enabled later, storage/egress can grow | Keep `GHOSTWRITER_ALLOW_PUBLIC_SHARING=false`; revoke route/domain if abused |
| Static assets/CDN | Asset bandwidth and request flood | Optimized local assets; no user uploads | Host/CDN limits unknown | Automatic bandwidth overage may be possible | CDN/WAF rate limits or disable deployment |
| GitHub Actions | CI minutes and action execution | Workflow triggers are bounded and dependencies/actions pinned; no production runtime secrets requested | Repository plan dependent | PR/push storms can consume CI minutes | Restrict workflow permissions/triggers and pause Actions |
| Domain/DNS/CDN | Request volume and protection plan | Security headers and origin checks in app | Provider unknown | Plan-dependent | DNS/CDN provider controls |

No Redis, object upload storage, payment processor, SMS, third-party analytics, Sentry/Datadog/Axiom, AI queue, background worker, or cron integration was found.

## Authoritative AI cost calculation

All ledger amounts are integer micro-USD and round upward:

| Dimension | Bound | Price | Reservation |
| --- | ---: | ---: | ---: |
| Input including server prompt | 2,000 tokens | $0.075 / 1M | 150 micro-USD |
| Completion including reasoning usage | 2,000 tokens | $0.30 / 1M | 600 micro-USD |
| Total actual maximum | — | — | **750 micro-USD ($0.000750)** |
| Database per-operation policy ceiling | — | — | **10,000 micro-USD ($0.01)** |

The wider $0.01 database ceiling follows the launch policy but does not authorize a $0.01 request: code reserves only the computed 750 micro-USD maximum for the exact model/token limits. A pricing change fails closed until the pricing version and tests are updated.

Atomic admission requires, for every hour/rolling-24h/lifetime window:

```text
settled cost + reserved/dispatched/uncertain reservation + 750 micro-USD <= configured limit
```

Failed operations release cost only when failure is durably recorded before provider dispatch. Ambiguous operations retain the full 750 micro-USD.

## Required external measurements before launch

Record, with owner and date:

- hosting monthly hard cap, invocation/CPU/bandwidth quotas, alert thresholds, and emergency disable path;
- Supabase compute/storage/egress/Auth email limits, spend cap behavior, pool size, backups/PITR, and alert thresholds;
- Groq project and organization rate/spend limits, billing delay, funding/auto-reload state, and recipients;
- CI minute cap and fork/PR workflow policy;
- DNS/CDN/WAF rate limits and origin protection;
- log retention, ingestion quota, sampling, and maximum monthly exposure.

Until those values are known, maximum infrastructure exposure is **unknown** and the launch verdict remains `DO NOT LAUNCH`.
