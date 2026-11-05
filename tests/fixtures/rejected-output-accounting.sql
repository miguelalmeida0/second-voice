-- Isolated database fixture only. Never run against a deployment.
-- Roll back every synthetic identity, operation and control change.
begin;
truncate public.ghostwriter_ai_operations, public.ghostwriter_canary;
update public.ghostwriter_ai_control set release_profile='portfolio-free', paused=false,
  valid_until='infinity', free_organization_id='org-isolated', free_project_id='project-isolated',
  free_verified_at=clock_timestamp(), free_verified_until=now()+interval '1 day',
  free_evidence_reference='synthetic-plan-fixture', portfolio_global_daily_limit=60,
  combined_ai_limit_24h=60;
select public.ghostwriter_retention_maintenance();

do $$
declare
  a uuid := '00000000-0000-0000-0000-000000000901';
  b uuid := '00000000-0000-0000-0000-000000000902';
  limits jsonb := '{"accounts":25,"accountLifetime":10,"accountDay":3,"accountMinute":3,"globalMinute":6,"hourBudget":500000,"dayBudget":2000000,"lifetimeBudget":10000000,"operationBudget":10000}';
  r jsonb;
  op uuid;
  dispatched timestamptz;
  authorized timestamptz;
begin
  assert not has_function_privilege('anon','public.ghostwriter_ai_settle_rejected_output(uuid,uuid,bigint,text)','execute');
  assert not has_function_privilege('authenticated','public.ghostwriter_ai_settle_rejected_output(uuid,uuid,bigint,text)','execute');
  assert has_function_privilege('service_role','public.ghostwriter_ai_settle_rejected_output(uuid,uuid,bigint,text)','execute');

  for i in 1..3 loop
    r:=public.ghostwriter_anonymous_reserve_bounded(a,'rejected-output-test-'||i,repeat('a',64),'org-isolated','project-isolated',limits,60);
    assert r->>'kind'='admitted', r::text; op:=(r->>'operation_id')::uuid;
    assert not public.ghostwriter_ai_settle_rejected_output(op,a,68,'unsent');
    assert public.ghostwriter_ai_mark_dispatched(op,a);
    select dispatched_at,global_dispatch_authorized_at into dispatched,authorized
      from public.ghostwriter_ai_operations where id=op;
    assert not public.ghostwriter_ai_settle_rejected_output(op,b,68,'wrong-owner');
    assert not public.ghostwriter_ai_settle_rejected_output(op,a,null,'missing-usage');
    assert not public.ghostwriter_ai_settle_rejected_output(op,a,-1,'negative-usage');
    assert not public.ghostwriter_ai_settle_rejected_output(op,a,751,'over-reservation');
    assert not public.ghostwriter_ai_settle_rejected_output(op,a,68,repeat('x',257));
    assert public.ghostwriter_ai_settle_rejected_output(op,a,68,'synthetic-provider-id');
    assert not public.ghostwriter_ai_settle_rejected_output(op,a,1,'duplicate');
    assert not public.ghostwriter_ai_settle_success(op,a,1,'late-success','{}');
    assert not public.ghostwriter_ai_mark_dispatched(op,a);
    assert (select state='settled' and outcome='failed' and actual_micro_usd=68
      and reserved_micro_usd=750 and failure_code='provider_output_rejected'
      and provider_request_id='synthetic-provider-id' and result_json is null
      and dispatched_at=dispatched and global_dispatch_authorized_at=authorized
      from public.ghostwriter_ai_operations where id=op);
  end loop;
  assert (select sum(actual_micro_usd)=204 from public.ghostwriter_ai_operations);
  assert (select not paused from public.ghostwriter_ai_control where singleton);
  r:=public.ghostwriter_anonymous_reserve_bounded(a,'rejected-output-test-4',repeat('a',64),'org-isolated','project-isolated',limits,60);
  assert r->>'reason'='anonymous_day_limit', r::text;
  -- Content rejection retains exact spend in the next reservation's budget.
  r:=public.ghostwriter_anonymous_reserve_bounded(b,'rejected-budget-test-1',repeat('a',64),'org-isolated','project-isolated',limits||'{"hourBudget":900}',60);
  assert r->>'reason'='hour_budget', r::text;
  -- Other visitors can continue; one bad answer does not pause the fleet.
  r:=public.ghostwriter_anonymous_reserve_bounded(b,'rejected-next-test-1',repeat('a',64),'org-isolated','project-isolated',limits,60);
  assert r->>'kind'='admitted', r::text; op:=(r->>'operation_id')::uuid;
  assert public.ghostwriter_ai_mark_dispatched(op,b);
  assert public.ghostwriter_ai_mark_uncertain(op,b,'missing_provider_usage');
  assert not public.ghostwriter_ai_settle_rejected_output(op,b,68,'late-response');
  assert (select state='uncertain' and actual_micro_usd is null and reserved_micro_usd=750
    from public.ghostwriter_ai_operations where id=op);
  r:=public.ghostwriter_anonymous_reserve_bounded(a,'rejected-uncertain-1',repeat('a',64),'org-isolated','project-isolated',limits,60);
  assert r->>'reason'='service_paused', r::text;
end $$;

truncate public.ghostwriter_ai_operations;
update public.ghostwriter_ai_control set paused=false;
insert into auth.users(id,email_confirmed_at,email)
  values('00000000-0000-0000-0000-000000000905',now(),'rejected-output@isolated.test');
insert into auth.sessions(id,user_id)
  values('00000000-0000-0000-0000-000000000905','00000000-0000-0000-0000-000000000905');
do $$
declare
  a uuid := '00000000-0000-0000-0000-000000000905';
  limits jsonb := '{"accounts":25,"accountLifetime":10,"accountDay":3,"accountMinute":3,"globalMinute":6,"hourBudget":500000,"dayBudget":2000000,"lifetimeBudget":10000000,"operationBudget":10000}';
  r jsonb;
  op uuid;
begin
  assert public.ghostwriter_free_entitle(a,a)='entitled';
  for i in 1..3 loop
    r:=public.ghostwriter_free_reserve_bounded(a,a,'rejected-account-'||i,repeat('a',64),'org-isolated','project-isolated',limits);
    assert r->>'kind'='admitted', r::text; op:=(r->>'operation_id')::uuid;
    assert public.ghostwriter_ai_mark_dispatched(op,a);
    assert public.ghostwriter_ai_settle_rejected_output(op,a,68,null);
  end loop;
  r:=public.ghostwriter_free_reserve_bounded(a,a,'rejected-account-4',repeat('a',64),'org-isolated','project-isolated',limits);
  assert r->>'reason'='account_day_limit', r::text;
end $$;

truncate public.ghostwriter_ai_operations;
update public.ghostwriter_ai_control set paused=false,combined_ai_limit_24h=1;
do $$
declare
  a uuid := '00000000-0000-0000-0000-000000000903';
  limits jsonb := '{"accounts":25,"accountLifetime":10,"accountDay":3,"accountMinute":3,"globalMinute":6,"hourBudget":500000,"dayBudget":2000000,"lifetimeBudget":10000000,"operationBudget":10000}';
  r jsonb;
  op uuid;
begin
  r:=public.ghostwriter_anonymous_reserve_bounded(a,'rejected-global-1',repeat('a',64),'org-isolated','project-isolated',limits,60);
  assert r->>'kind'='admitted', r::text; op:=(r->>'operation_id')::uuid;
  assert public.ghostwriter_ai_mark_dispatched(op,a);
  assert public.ghostwriter_ai_settle_rejected_output(op,a,68,null);
  assert (ghostwriter_private.combined_ai_capacity()->>'used')::int=1;
  begin
    perform public.ghostwriter_anonymous_reserve_bounded('00000000-0000-0000-0000-000000000904','rejected-global-2',repeat('a',64),'org-isolated','project-isolated',limits,60);
    raise exception 'Rejected output incorrectly refunded global capacity';
  exception when sqlstate 'GW429' then null; end;
end $$;
rollback;
