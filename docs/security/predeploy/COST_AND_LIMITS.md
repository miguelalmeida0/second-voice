# Cost and limits — 15 September 2026

| Service / selected owner/project | Plan/source/date | Attacker meters | Hard control, lag/exclusions and failure |
| --- | --- | --- | --- |
| Groq project_01kpvdq6b7fjxrq47rtdke18p7; historical org_01kpvdq5t7fjnaxhfhwvz7kq7f | UNVERIFIED Sep15 login required; Sep8 Free historical | Tokens/direct key/batch if externally enabled | Local atomic starts/one call, not direct-key cap.429/error/timeout deny or uncertain+pause. No fallback; key entitlement/payment/add-ons/accounting pending. |
| Supabase oycnkdlmdhfhmuuyfyqt / xklbazwgaucvimapgfbq | Identity ACTIVE_HEALTHY VERIFIED ON TARGET Sep15; billing/add-ons UNVERIFIED | Auth/DB CPU/rows/egress/Storage/cron | SQL3s/HTTP10s bounds and bounded rows/batches, not platform dollar cap. Outage denies; verify Free inactivity/backup/overage behavior. |
| Vercel historical prj_QigqdvWvfo0tImNgMDonfELF9FIk / team_yiVtxHRnCt6hDEzgVpYMjlBz | Current access denied; Sep8 Hobby historical | Functions/bandwidth/images/logs/builds | App rejection consumes resources. No fleet ingress dollar cap. Verify exact noncommercial plan/add-ons/current deployment. |
| GitHub | OAuth/repo source; current account protections UNVERIFIED | Auth and permitted CI | Pinned actions/read-only CI/no pull_request_target; user:email only; no unique-human guarantee. |
| Gmail support | OWNER-ATTESTED inbox | Manual mail, no app relay | No automated sending path; support/alert delivery test pending approval. |

Preserved maxima:25 nonrecycled recipients;10 lifetime/account;3/account/24h;1/account/minute;2 global/minute;25 global/24h;250 release lifetime;one active operation.10,000bodybytes;2,000inputchars;complete prompt conservative byte+overhead bound;max_completion_tokens2,000;65,536responsebytes;30s provider;0 inference retries/tools/fallback/background. Stricter settings retained.

Starts include dispatched uncertainty. Same key/account/digest replays without dispatch; different digest conflicts. Database clock/lock coordinates workers. Logout/deletion/recreation never refunds starts/slots. Irreversible retirement prevents later purge from reopening enrollment.

750microUSD is an estimate under pinned rates, not a bill guarantee. Paid-policy expiry is not renewed; historical test clocks are isolated. [Groq API](https://console.groq.com/docs/api-reference) documents max_completion_tokens; [reasoning](https://console.groq.com/docs/reasoning) says include_reasoning=false controls presentation, not absence of reasoning. Full model-specific pre-dispatch reasoning/billable accounting remains a canary question. [Model list](https://console.groq.com/docs/models) still lists gpt-oss-20b; no key-specific call made.

Target lease expiredSep9; five pending migrations. Personal/date labels prove no plan. No direct SQL unpause/reset/renewal. Other projects, leaked keys, old deployments, host meters and changing provider terms remain outside app-ledger guarantees.
