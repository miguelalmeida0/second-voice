# Authenticated Groq account check — 8 September 2026

## Approved remediation completed

Following explicit owner approval, revoked only `key-Miguel Almeida`. The key disappeared from the inventory; `ghostwriter-prod` and `ghost` remained. Revocation is irreversible; no replacement was created or needed for this unused key.

Enabled **Inference APIs ZDR** in Personal and verified the console shows Enabled with its switch checked. Global ZDR remains Disabled; Batch and Fine-tuning/LoRA settings remain On and unchanged. No deployment, inference call or application credential change was made. This supersedes the initial disabled-ZDR and pending-revocation findings below; it does not claim retroactive erasure of previously retained provider data.

Read-only inspection of the owner's signed-in Chrome console. No settings changed, key created/revoked, or inference request made by the assistant.

## Verified account facts

- Organization: Personal, `org_01kpvdq5t7fjnaxhfhwvz7kq7f`.
- Billing page: Free, $0, Current Plan. This closes the previous missing authenticated Free-plan evidence for this organization at inspection time.
- Selected project: Default Project, `project_01kpvdq6b7fjxrq47rtdke18p7`, matching the intended target.
- Project key inventory includes `ghostwriter-prod`, created 7 September 2026, last used 8 September 2026, six calls in the displayed 24-hour window. This proves the named key exists in the intended project; it does not prove which credential is injected into every deployment.
- Global ZDR disabled; Inference APIs ZDR disabled. The account UI states inference inputs/outputs may be stored for up to 30 days for reliability/compliance. Local seven-day expiry does not erase those provider copies.

## Credential incident requiring approval

The landing page unexpectedly included a newly displayed complete credential in the browser inspection output. Its masked suffix matches the inventory entry `key-Miguel Almeida`, created today, never used, zero displayed API calls. No secret is reproduced in this report or copied into application configuration. Treat that key as exposed and revoke it before release. Do not rotate the existing `ghostwriter-prod` key by mistake.

Ask owner approval to revoke this exact new key, and separately to enable Inference APIs ZDR for Personal. The latter is organization-wide; Global ZDR would additionally disable storage-dependent features and is not implied by this recommendation. No replacement key is needed merely to remove the unused exposed credential.

## Remaining boundary

This closes only the logged-out Free-plan/project inspection gap. Runtime key identity, full token accounting, processor arrangements, other hosted-provider controls and the approved schema/runtime rollout remain open. No deployment or canary is authorized by signing in. The last passing code verification is unchanged; this new report is documentation-only and was added afterward.
