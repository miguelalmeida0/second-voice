# Twenty-item coverage — 15 September 2026

VERIFIED LOCALLY refers only to named tests/source; VERIFIED ON TARGET only to fresh readbacks. OWNER-ATTESTED is not provider confirmation. Final statuses follow EVIDENCE.json.

| Original label | Applicability | Current implementation / evidence / defect or remaining impact |
| --- | --- | --- |
| 1. BETA TEST | APPLICABLE | Ordinary synthetic Auth, production desktop/mobile all selections, input/quick starts/copy/logout/refresh/quota/errors. Human beta and target GitHub acceptance pending. |
| 2. CRASH REPORTS | APPLICABLE | Sanitized allowlisted server events,60/process/minute and dedup; private client source maps disabled. Unit capture test; centralized client collector/monitored delivery and host retention unverified. No session replay. |
| 3. DELETE ACCOUNT BUTTON | APPLICABLE | How it works → Account & deletion; recent original session, explicit confirmation, durable fence, bounded Storage/Auth cleanup/receipt. Local interruption/race tests. Hosted migrations pending. |
| 4. PRIVACY POLICY | APPLICABLE | Reachable before sign-in/in-app with approved Miguel/contact/retention. Controller identification, processor/transfer/legal review pending. |
| 5. DECLARE SDKS | ADAPTED | Next/React/Supabase/Zod/motion/icons and local fonts/images; no ad SDK. Browser traffic checked locally. Native declaration N/A. |
| 6. SPF, DKIM, DMARC | ADAPTED | GitHub login; no owner sending domain/SMTP addition. Gmail support provider-owned; no unapproved DNS/mail mutation. Hosted disabled-provider readback pending. |
| 7. TESTING SIGNUP | APPLICABLE | Signed PKCE envelope/canonical origin, minimal user:email; claims/user/durable session. Local refresh/logout/revocation/unavailable tests; target redirects/MFA pending. |
| 8. CAP API $$$ | APPLICABLE | Shared SQL lock/start ledger; two workers,100attempts, replay/failure/mutations. Other host meters not capped by ledger. |
| 9. LLM CREDIT BALANCE | APPLICABLE | Fixed Groq/gpt-oss-20b,2k generation parameter,30s/no retries/tools/fallback. Current key entitlement and hidden-reasoning accounting remain unverified. |
| 10. MOVE OFF FREE TIERS | ADAPTED | No upgrade. Current exact Free/overage/add-ons evidence required; host denied/Groq signed out. Free suspension/backup/availability tradeoffs documented. |
| 11. DB RESTORE | APPLICABLE | Encrypted synthetic stale restore, RLS/session/deletion/usage and retirement recovery checks. Production blobs/off-site/config/key custody unverified. |
| 12. SHIP KILL SWITCH | APPLICABLE | Durable operator pause/dispatch claim/lease; uncertain starts retained. Emergency host/key containment prepared, not executed. |
| 13. OTA HOT FIX | ADAPTED | Web code-artifact rollback, never ledger refund; repaired phase preflight. Host rollback/old deployment isolation pending. No mobile OTA. |
| 14. SUPPORT EMAIL | APPLICABLE | Owner-approved miguelalmeida1592@gmail.com; no credentials requested. Inbound/alert test needs approval. |
| 15. USE BIZ ADDRESS | ADAPTED | Personal portfolio confirmed; DDG/MStV/controller identification/address applicability unresolved; nothing invented/published. |
| 16. USE DEMO ACCOUNT | ADAPTED | Ordinary isolated synthetic accounts and labeled precomputed film; no public credentials or inference bypass. |
| 17. RESTORE PURCHASES | NOT APPLICABLE | No payment/subscription/native entitlement integration found; none added. |
| 18. SWAP TEST KEYS | ADAPTED | Dedicated server credentials, production-fixture/preview denial, redacted history/working-tree/client canary scans. Current hosted old-artifact secrets/MFA pending; no blind rotation. |
| 19. PHASE RELEASES | APPLICABLE | Local → approved AI-disabled → target HTTPS/auth/ingress → approved one-operation+replay → staffed beta. Verifier now includes omitted failure/restore suite. |
| 20. NEVER FRIDAY | ADAPTED | Staffed release and observation/kill readiness, not weekday rule. No unattended launch. |

Test lenses: OWASP ASVS5.0 authentication/session/access/input/output/logging, API Top10 object/function authorization/resource consumption, LLM prompt injection/disclosure/unbounded consumption. No certification claimed.
