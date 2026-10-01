# Threat model

## Architecture and data flow

Browser → same-origin Next route → signed shield/CSRF and durable abuse guard → verified Supabase Auth identity/session → shared Postgres admission → separate dispatch claim → fixed Groq endpoint → bounded response validation → settlement → private browser output. A late session check precedes replay/final output. Deletion serializes on the same ledger lock and redacts late persisted output.

The model receives system instructions and submitted text, not database credentials, tools, browsing authority or quota decisions. Its text is rendered as text, not executable HTML or remote-image markup. Prompt instructions are not the authorization boundary.

## Assets and trust boundaries

Private drafts/output; Auth cookies and PKCE verifier; Supabase privileged credentials; Groq key; stable idempotency fingerprint key; independent shield/challenge/artifact/OAuth signing purposes; trial slots/identity deduplication; dispatched and uncertain liabilities; revocation and deletion records; operator credentials and artifact provenance.

Browser fields, IP headers, provider content, optional artifact tokens and restored backups are untrusted at their boundaries. Runtime RPC privileges differ from owner/operator privileges. A correctly signed artifact historically bound content, not current account ownership; optional public features are therefore closed for this release.

## Attacker capabilities and abuse cases

Anonymous callers can obtain shield cookies, send malformed bodies/callbacks and vary identities. Ordinary verified users can race clicks, keys, accounts, refresh/logout and deletion. Attackers can replay stolen bearer artifacts or tokens, enumerate IDs, probe direct Supabase grants and attempt expensive image or log paths. Compromised provider keys bypass the app ledger; compromised owner credentials exceed runtime scope. Multiple verified identities/IPs are not proof of distinct humans.

## Security objectives and assumptions

Admission must be atomic before provider execution, with nonrecycled starts/slots and conservative uncertainty. Missing or malformed policy fails closed. Same operation replays without dispatch; changed bodies conflict; account ownership is checked by SQL. Pause/lease/revocation/deletion must survive worker changes. Restore must never become a quota refund.

Unverified external plan, ingress, secrets, current deployment/schema and retention facts are assumptions—not established controls. Source inspection covers discovered application routes and selected helpers/tests; it is not an exhaustive review of every asset, dependency implementation or account setting.

## Route inventory

| Surface | Identity / authorization | Bounds / cost / persistence |
| --- | --- | --- |
| POST /api/ghostwriter | CSRF/shield/PoW + verified Auth/session + entitlement + atomic ledger | Strict schema, 10k bytes/2k chars/body deadline; account/global limits; fixed single provider; bounded private result/replay |
| POST /api/ghostwriter/auth | Shield/CSRF; action limits; Auth for protected actions | Strict action schema, bounded body; GitHub or explicitly enabled email; status/refresh/logout, no inference |
| GET /api/ghostwriter/auth/callback | Signed app-issued PKCE cookie; Supabase code/state exchange; canonical origin | Single bounded code, limited query parameters, global/verifier rate bounds; short-lived cookies, no retained provider token in app |
| GET /api/ghostwriter/challenge | Browser shield/CSRF / abuse guard | Bounded PoW token; replay-state persistence and separate rates; no inference |
| POST /api/ghostwriter/account/delete | Recent authoritative session plus explicit confirmation; receipt only resumes committed account | Auth-purpose ingress; ten-minute original session; one Storage removal per continuation; Auth deletion; durable tombstone, no usage refund |
| POST /api/ghostwriter/share | Free profile denies server-side | 404 before parsing; non-Free legacy bearer-artifact design not certified for re-enabling |
| POST /api/ghostwriter/feedback | Free profile denies server-side | 404 before parsing; legacy feedback not used in Free release |
| POST /api/ghostwriter/lab | Production/Free profile denies server-side | 404 before body or inference; development legacy parser remains outside deployed path |
| /g/[id] | Free sharing disabled | Null lookup/not-found; DB public lookup grants revoked; legacy cache purge needs target review |
| /api/og/[id] | Same public feature gate | Missing/disabled returns 404/no-store instead of generating SVG for arbitrary IDs |
| /demo/portfolio-film | Precomputed demo, no live Auth privilege | No provider generation; fixture enablement prevented in production policy |
| /second-voice, /second-voice/account | Public shell; protected operations authorize independently | Nonce CSP/shield; native document scroll; private React state; account page contains no personal server-rendered content |
| /second-voice/case-study, /ghostwriter aliases, / | Public editorial pages/redirects | No spending authority; same baseline headers |
| /_next/image and static assets | Public framework route | No remote image allowlist; deployed transformation quotas/patch binary must be verified |
| /second-voice/privacy | Public notice/contact, no personal response | Static page; no inference or private record read |
| Retention cron | Owner-installed pg_cron, no public HTTP entry | Bounded batches; five-minute schedule; two-hour heartbeat gates active trial. Locally tested, not installed on target. |
| Server actions, custom admin HTTP, user uploads, payments | None found in discovered source inventory | Operator is a separate local CLI, not an exposed admin route |

## Resource paths outside inference

Auth/DB ingress, abuse writes, callback exchanges, static bandwidth, image variants, function CPU/duration, security logs, CI builds and platform storage all remain meters. Database row cardinality is capped for abuse state; per-process event suppression is not a fleet billing cap. Rate limits may reject legitimate shared-IP users. No artificial keep-alive traffic or paid service was added.

Repository: /Users/malmeida/Documents/mockup/ghostwritter
Version: see EVIDENCE.json artifact identity (mutable working tree)

Updated15September2026: runtime uses a Supabase service-role credential for Auth administration and Storage removal, not a custom least-privilege credential. Named application operator grants are separately denied. Actual hosted grants/billing/ingress remain unverified. Static scan2c91158e-954b-4a89-91f1-be459c71a4cc has partial coverage; architecture report under .tmp/predeploy/architecture-20260915.json contains source-backed resource chains. Use the current READINESS, not dated follow-up reports, for release decisions.
