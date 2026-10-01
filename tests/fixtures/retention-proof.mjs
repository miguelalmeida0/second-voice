import assert from "node:assert/strict";
import { seedCombinedHistory } from "./combined-history-seed.mjs";
export function retentionProof(sql){
 sql("update public.ghostwriter_canary set active=false; update public.ghostwriter_ai_control set release_profile='portfolio-free',free_verified_at=coalesce(free_verified_at,clock_timestamp()),paused=false,valid_until='infinity'::timestamptz;select public.ghostwriter_retention_maintenance();");
 // The isolated ledger harness creates auth users after all migrations have run.
 // Migration 202609150001 backfills portfolio entitlements only for rows that
 // existed at migration time, so the non-portfolio integration path must seed
 // one synthetic entitlement explicitly before exercising retention. This is
 // fixture-only setup; production enrollment and entitlement SQL are unchanged.
 sql("insert into public.ghostwriter_portfolio_entitlements(account_id,identity_hash,claimed_at) select u.id,encode(sha256(convert_to(lower(btrim(u.email)),'UTF8')),'hex'),clock_timestamp() from auth.users u where u.email_confirmed_at is not null and public.ghostwriter_ai_session_active(u.id,u.id) and not exists(select 1 from public.ghostwriter_portfolio_entitlements e where e.account_id=u.id) order by u.id limit 1 on conflict do nothing;");
 const account=sql("select u.id from auth.users u join public.ghostwriter_portfolio_entitlements e on e.account_id=u.id where public.ghostwriter_ai_session_active(u.id,u.id) and e.revoked_at is null order by u.id limit 1;");assert.ok(account);
 seedCombinedHistory(sql,`insert into public.ghostwriter_ai_operations(account_id,session_id,idempotency_key,request_fingerprint,state,outcome,pricing_version,reserved_micro_usd,actual_micro_usd,dispatched_at,settled_at,profile,principal_kind,result_json) select '${account}','${account}','retention-fixture-'||n,repeat('c',64),'settled','succeeded','synthetic',750,30,clock_timestamp(),clock_timestamp(),'portfolio-free','authenticated','{"rewrite":"synthetic"}'::jsonb from generate_series(1,105)n;`);
 sql("alter table public.ghostwriter_ai_operations disable trigger ghostwriter_retention_redaction;update public.ghostwriter_ai_operations set settled_at=clock_timestamp()-interval '8 days' where idempotency_key like 'retention-fixture-%';alter table public.ghostwriter_ai_operations enable trigger ghostwriter_retention_redaction;");
 const before=sql("select count(*)||':'||sum(actual_micro_usd)||':'||count(dispatched_at) from public.ghostwriter_ai_operations;");assert.equal(JSON.parse(sql("select public.ghostwriter_retention_maintenance();")).expiredPayloads,100);assert.equal(JSON.parse(sql("select public.ghostwriter_retention_maintenance();")).expiredPayloads,5);assert.equal(sql("select count(*)||':'||sum(actual_micro_usd)||':'||count(dispatched_at) from public.ghostwriter_ai_operations;"),before);
 sql("update public.ghostwriter_lifecycle set retire_at=clock_timestamp()-interval '1 second';select public.ghostwriter_retention_maintenance();");assert.equal(sql("select retired_at is null from public.ghostwriter_lifecycle;"),"t");assert.equal(sql("select public.ghostwriter_release_active();"),"t");assert.equal(sql("select count(*) from public.ghostwriter_ai_operations where idempotency_key like 'retention-fixture-%';"),"105");
 sql("update public.ghostwriter_lifecycle set retired_at=clock_timestamp() where singleton;");assert.equal(sql("select public.ghostwriter_release_active();"),"f");
 console.log(JSON.stringify({scenario:"bounded-retention-durable-portfolio-lifecycle",status:"PASS"}));
}
