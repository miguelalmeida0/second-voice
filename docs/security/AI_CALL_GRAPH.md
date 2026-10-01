# Owner-funded AI call graph

Verified: 2026-09-07.

## Canonical live path

```text
Browser POST /api/ghostwriter
  -> same-origin + CSRF + signed browser shield + durable PoW replay check
  -> Content-Type/Content-Encoding + streaming 10,000-byte body cap
  -> strict application schema (unknown fields rejected)
  -> executeGovernedRewrite
       -> exact policy/provider/model/pricing validation
       -> Supabase bearer authentication + verified email
       -> idempotency-key syntax + HMAC request fingerprint
       -> conservative total-input upper bound
       -> atomic PostgreSQL entitlement/quota/concurrency/budget reservation
       -> AI_ENABLED check
       -> durable DISPATCHED transition
       -> AI_ENABLED recheck immediately before external fetch
       -> dispatchRewriteToProvider (the only paid fetch; zero retries)
       -> provider usage/schema/cost validation
       -> private result persistence
       -> atomic settlement or UNCERTAIN quarantine
  -> plain-text React result
```

## Invocation inventory

| Caller / route | Live owner-funded call? | Authn / authz | Provider / model | Input / output | Retry / timeout / stream | Concurrency / idempotency | Maximum reserved cost | Global budget gate |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- |
| `POST /api/ghostwriter` -> `executeGovernedRewrite` -> `dispatchRewriteToProvider` | Yes, only when explicitly enabled | Valid Supabase bearer user, verified email, active server entitlement | Groq / `openai/gpt-oss-20b`, fixed server-side | Total prompt upper bound 2,000 tokens; `max_completion_tokens=2,000`; body 10,000 bytes | 0 automatic retries; 30 s; non-streaming; `n=1`; reasoning effort low; no exposed reasoning | Account active 1; global active 2; durable key/fingerprint required | 750 micro-USD ($0.000750) at audited list prices; DB per-operation ceiling $0.01 | Yes, atomic before dispatch |
| `POST /api/ghostwriter/lab` | No | Browser guard still applies | None | Strict schema/body cap | No provider request | No paid work | $0 | Not applicable; returns 503 |
| `/demo/portfolio-film` and UI fixture defaults | No | Development/explicit demo surface | None; prerecorded fixture | Static local data | None | None | $0 | Not applicable |
| Challenge, feedback, share, public artifact page, OG image | No | Route-specific shield/provenance/public-state rules | None | Bounded strict inputs | None | Durable abuse limits where state changes | $0 AI | Not applicable |

## Provider request construction

Only `src/server/ai-provider.ts` contacts an AI API. It constructs the request from server-owned values:

- URL: exact Groq Chat Completions endpoint.
- Model: exact `openai/gpt-oss-20b` allowlist.
- Messages: one server-built system prompt and the validated passage.
- Output: exact server ceiling through `max_completion_tokens`.
- `n=1`, `stream=false`, `reasoning_effort=low`, `include_reasoning=false`.
- No client headers, base URL, API key, model, system prompt, messages array, tools, search, RAG, retry count, or token override is forwarded.
- Response body is capped at 64 KiB and must contain strict usage plus a valid rewrite.

The retired provider/fallback logic was removed from `src/server/ghostwriter.ts`. Gemini is not a configured or callable path. Rewrite Lab’s former multi-pass candidate/evaluator workflow is disabled for the initial closed beta.

## Cost proof

Pricing is stored as integer micro-USD per million tokens:

```text
input:  2,000 * 75,000 / 1,000,000 = 150 micro-USD
output: 2,000 * 300,000 / 1,000,000 = 600 micro-USD
maximum reservation                         750 micro-USD
```

Each component rounds upward with integer arithmetic. Cached input is conservatively reserved at the more expensive normal-input rate. No other billable dimension is enabled.

The startup check, runtime policy resolver, and PostgreSQL RPC each reject values above the audited account, rate, concurrency, and budget ceilings. The SQL entitlement-slot check also enforces any configured approved-account ceiling below 25, so skipping startup validation cannot enlarge the durable envelope.

## State and retry behavior

```text
RESERVED -> DISPATCHED -> SETTLED(succeeded)
    |           |              |
    |           +-----------> UNCERTAIN (full reservation retained)
    +-----------------------> FAILED (only before provider dispatch)
```

- Same key and same fingerprint: settled success is replayed without a provider call; pending/dispatched/uncertain is not regenerated.
- Same key and different fingerprint: HTTP 409.
- Provider timeout, disconnect, 429, 500, invalid response, out-of-bounds usage, result persistence failure, or settlement failure: no automatic retry; preserve/quarantine at maximum reservation.
- Client disconnect does not release a dispatched reservation.

## Static assertion

The security suite asserts that the only external AI `fetch` appears in `src/server/ai-provider.ts`, that the live route calls the governed gateway, that Lab contains no fetch, and that the request pins model/token/retry-relevant parameters. Any future AI, batch, worker, cron, admin, or internal path must call the same reservation gateway; there is no admin bypass.
