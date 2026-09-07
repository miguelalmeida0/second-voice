-- Isolated database fixture only. Never run against a deployment.
truncate public.ghostwriter_ai_operations, public.ghostwriter_revoked_sessions;
update public.ghostwriter_ai_control set paused=false,valid_until=clock_timestamp()+interval '1 hour';
do $$
declare
 a uuid := '00000000-0000-0000-0000-000000000002';
 r jsonb;
 op uuid;
begin
 r:=public.ghostwriter_ai_reserve(a,a,'failure-matrix-0001',repeat('a',64),'groq-openai-gpt-oss-20b-2026-09-07',750,25,10,5,3,1,10,2,500000,2000000,10000000);
 assert r->>'kind'='admitted'; op:=(r->>'operation_id')::uuid;
 assert public.ghostwriter_ai_mark_dispatched(op,a);
 assert not public.ghostwriter_ai_fail_before_dispatch(op,a,'late_release');
 assert public.ghostwriter_ai_report_anomaly(op,a,2000);
 assert public.ghostwriter_ai_report_anomaly(op,a,100);
 assert public.ghostwriter_ai_report_anomaly(op,a,null);
 assert (select observed_micro_usd=2000 and reserved_micro_usd=750 and state='uncertain' from public.ghostwriter_ai_operations where id=op);
 assert (select paused from public.ghostwriter_ai_control where singleton);
 assert not public.ghostwriter_ai_settle_success(op,a,38,'late-response','{}');
 -- Simulate an authorized reconciliation above the original reservation.
 update public.ghostwriter_ai_operations set state='settled',actual_micro_usd=2000,outcome='failed',settled_at=clock_timestamp() where id=op and state='uncertain';
 assert not public.ghostwriter_ai_mark_dispatched(op,a);
 assert not public.ghostwriter_ai_settle_success(op,a,38,'stale-worker','{}');
 assert not public.ghostwriter_ai_fail_before_dispatch(op,a,'duplicate_recovery');
 assert (select actual_micro_usd=2000 from public.ghostwriter_ai_operations where id=op);
 assert (select paused from public.ghostwriter_ai_control where singleton);
end $$;

truncate public.ghostwriter_ai_operations;
update public.ghostwriter_ai_control set paused=false;
do $$
declare a uuid := '00000000-0000-0000-0000-000000000002'; r jsonb; op uuid;
begin
 r:=public.ghostwriter_ai_reserve(a,a,'safe-release-000001',repeat('a',64),'groq-openai-gpt-oss-20b-2026-09-07',750,25,10,5,3,1,10,2,500000,2000000,10000000);
 assert r->>'kind'='admitted'; op:=(r->>'operation_id')::uuid;
 assert public.ghostwriter_ai_fail_before_dispatch(op,a,'provably_unsent');
 assert not public.ghostwriter_ai_fail_before_dispatch(op,a,'duplicate');
 assert not public.ghostwriter_ai_mark_dispatched(op,a);
 assert (select count(*)=1 from public.ghostwriter_ai_operations where account_id=a);
 r:=public.ghostwriter_ai_reserve(a,a,'aged-reservation-0001',repeat('a',64),'groq-openai-gpt-oss-20b-2026-09-07',750,25,10,5,3,1,10,2,500000,2000000,10000000);
 assert r->>'kind'='admitted'; op:=(r->>'operation_id')::uuid;
 update public.ghostwriter_ai_operations set created_at=clock_timestamp()-interval '31 seconds' where id=op;
 assert not public.ghostwriter_ai_mark_dispatched(op,a);
 assert (select state='reserved' and actual_micro_usd is null from public.ghostwriter_ai_operations where id=op);
 r:=public.ghostwriter_ai_reserve(a,a,'aged-new-request-0001',repeat('a',64),'groq-openai-gpt-oss-20b-2026-09-07',750,25,10,5,3,1,10,2,500000,2000000,10000000);
 assert r->>'reason'='account_concurrency_limit';
 update public.ghostwriter_ai_control set valid_until=clock_timestamp()-interval '1 second';
 assert not public.ghostwriter_ai_mark_dispatched(op,a);
end $$;

truncate public.ghostwriter_ai_operations;
update public.ghostwriter_ai_control set paused=false,valid_until=clock_timestamp()+interval '1 hour';
insert into public.ghostwriter_canary(singleton,run_id,account_id) values(true,'00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000002');
do $$
declare a uuid := '00000000-0000-0000-0000-000000000002'; other_account uuid := '00000000-0000-0000-0000-000000000003'; r jsonb; op uuid;
 k text := 'canary-00000000-0000-0000-0000-000000000100';
begin
 begin
  perform public.ghostwriter_ai_reserve(other_account,other_account,k,repeat('a',64),'groq-openai-gpt-oss-20b-2026-09-07',750,25,10,5,3,1,10,2,500000,2000000,10000000);
  raise exception 'Non-owner canary unexpectedly admitted';
 exception when insufficient_privilege then null; end;
 r:=public.ghostwriter_ai_reserve(a,a,k,repeat('a',64),'groq-openai-gpt-oss-20b-2026-09-07',750,25,10,5,3,1,10,2,500000,2000000,10000000);
 assert r->>'kind'='admitted'; op:=(r->>'operation_id')::uuid;
 assert public.ghostwriter_ai_mark_dispatched(op,a);
 assert not public.ghostwriter_ai_mark_dispatched(op,a);
 assert public.ghostwriter_ai_settle_success(op,a,38,'canary-synthetic','{}');
 r:=public.ghostwriter_ai_reserve(a,a,k,repeat('a',64),'groq-openai-gpt-oss-20b-2026-09-07',750,25,10,5,3,1,10,2,500000,2000000,10000000);
 assert r->>'kind'='replay'; assert (r->>'operation_id')::uuid=op;
 begin
  perform public.ghostwriter_ai_reserve(a,a,'canary-second-attempt',repeat('a',64),'groq-openai-gpt-oss-20b-2026-09-07',750,25,10,5,3,1,10,2,500000,2000000,10000000);
  raise exception 'Second distinct canary unexpectedly admitted';
 exception when insufficient_privilege then null; end;
 assert (select operation_id=op from public.ghostwriter_canary where singleton);
 delete from auth.users where id=a;
 assert not public.ghostwriter_ai_session_active(a,a);
 assert (select actual_micro_usd=38 from public.ghostwriter_ai_operations where id=op);
 assert (select count(*)=1 from public.ghostwriter_beta_entitlements where account_id=a);
end $$;
