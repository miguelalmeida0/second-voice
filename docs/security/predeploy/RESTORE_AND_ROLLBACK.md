# Recovery — 15 September 2026

Synthetic production-gate rehearsal only; no production backup/restore/deletion. verify:portfolio now requires it.

AES-256-GCM stale synthetic dump,0600 file/0700 ignored directory; decrypt/authenticate then restore isolated_restore without attached app/provider. Negative control demonstrates stale session resurrection. Reapply newer trusted usage/entitlement/deletion/revocation rows; erase deleted private data; verify RLS/grants/session denial and dispatch totals. Independently pause irrespective of restored control.

New lifecycle test detects pre-retirement stale row, reapplies stricter synthetic retirement/purged totals and rejects reopening/reducing totals. These are fixture facts, not invented production reconciliation. Missing authoritative history means remain paused/invalidate affected sessions, never manufacture usage.

Final production-gate.json records measured same-host recovery time. RPO is latest available synthetic fixture state; no production RPO promise. Encryption key destroyed afterward; ciphertext intentionally unrecoverable, not an operational backup.

| Resource | Coverage |
| --- | --- |
| Public/Auth schemas/data/functions/RLS/grants | Isolated restore/access assertions |
| Newer usage/revocation/deletion/lifecycle | Synthetic reconciliation and negative controls |
| Storage blobs | Local deletion/failure proof, NOT backup restoration |
| Migration ledger/roles/external config | Production export/restore inclusion must be verified separately |
| Off-site copy/key custody/provider/OAuth/DNS/hosting | UNVERIFIED; not included in one SQL dump |

Production procedure, only after exact approval: verify Supabase project oycnkdlmdhfhmuuyfyqt and live deploymentUUID; independently disable inference/key access across deployments and processing; preserve newer restricted recovery records; restore isolated first; reconcile irreversible lifecycle/purged totals and all newer liabilities/deletions/revocations; verify ordinary-account isolation/blob integrity. Missing trusted history → no resume. Approve canary separately.

Rollback **code artifact**, never financial/revocation history. Pending migrations revoke legacy runtime RPCs; old code may fail closed. Use compatible AI-disabled artifact, never restore unsafe grants. Host rollback/preview containment and backup custody remain untested due current target access/authority limits.
