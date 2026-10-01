-- Long-lived portfolio reliability without weakening spend, abuse, Auth or dispatch fences.

alter table public.ghostwriter_ai_operations
  add column principal_kind text not null default 'authenticated'
  check (principal_kind in ('authenticated','anonymous'));

create index ghostwriter_ai_operations_principal_day_idx
  on public.ghostwriter_ai_operations(principal_kind,account_id,dispatched_at,id)
  where profile='portfolio-free';

-- Portfolio authentication must not self-destruct after a finite recruiter count.
create table public.ghostwriter_portfolio_entitlements (
  account_id uuid primary key,
  identity_hash text not null unique check(identity_hash ~ '^[a-f0-9]{64}$'),
  claimed_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.ghostwriter_portfolio_entitlements enable row level security;
revoke all on public.ghostwriter_portfolio_entitlements from public,anon,authenticated,service_role;
insert into public.ghostwriter_portfolio_entitlements(account_id,identity_hash,claimed_at,revoked_at,created_at)
select account_id,free_identity_hash,free_claimed_at,revoked_at,coalesce(free_claimed_at,approved_at)
from public.ghostwriter_beta_entitlements
where free_claimed_at is not null and free_identity_hash is not null
on conflict do nothing;

-- Deletion immediately fences the new portfolio entitlement too.
create function public.ghostwriter_portfolio_deletion_fence() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$ begin
 update public.ghostwriter_portfolio_entitlements
 set revoked_at=coalesce(revoked_at,clock_timestamp()) where account_id=new.account_id;
 return new;
end $$;
create trigger ghostwriter_portfolio_deletion_fence after insert on public.ghostwriter_deletions
 for each row execute function public.ghostwriter_portfolio_deletion_fence();
revoke all on function public.ghostwriter_portfolio_deletion_fence() from public,anon,authenticated,service_role;

alter table public.ghostwriter_ai_control
  add column free_verified_at timestamptz,
  add column portfolio_global_daily_limit integer not null default 60 check(portfolio_global_daily_limit between 1 and 100),
  add column portfolio_monthly_budget_micro_usd bigint not null default 2000000 check(portfolio_monthly_budget_micro_usd between 10000 and 10000000),
  add column database_warn_bytes bigint not null default 419430400 check(database_warn_bytes between 104857600 and 500000000),
  add column database_hard_bytes bigint not null default 482344960 check(database_hard_bytes between 209715200 and 524288000),
  add constraint ghostwriter_database_threshold_order check(database_warn_bytes < database_hard_bytes);

update public.ghostwriter_ai_control
set free_verified_at=coalesce(free_verified_at,free_verified_until-interval '30 days',updated_at),
    valid_until=case when release_profile='portfolio-free' then 'infinity'::timestamptz else valid_until end,
    free_limits=jsonb_set(jsonb_set(jsonb_set(free_limits,'{accountDay}','3'::jsonb),'{accountMinute}','3'::jsonb),'{globalMinute}','6'::jsonb)
where singleton;

-- Applying this migration is a maintenance event so the release has time to verify cron.
update public.ghostwriter_lifecycle set last_maintenance_at=clock_timestamp()
where singleton and retired_at is null;

-- Explicit retirement is permanent. Historical retire_at is audit metadata, not a future outage timer.
create or replace function public.ghostwriter_release_active() returns boolean
language sql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
 select exists(select 1 from public.ghostwriter_lifecycle where singleton and retired_at is null
 and last_maintenance_at>clock_timestamp()-interval '36 hours')
$$;
revoke all on function public.ghostwriter_release_active() from public,anon,authenticated,service_role;

-- Durable Free review metadata remains required, but no monthly calendar kill switch.
create or replace function public.ghostwriter_free_control_valid() returns boolean
language sql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
 select public.ghostwriter_release_active() and exists(
  select 1 from public.ghostwriter_ai_control where singleton
   and release_profile='portfolio-free' and not paused
   and free_verified_at is not null
   and length(free_organization_id) between 3 and 120
   and length(free_project_id) between 3 and 120
   and length(free_evidence_reference) between 3 and 240
   and pg_database_size(current_database()) < database_hard_bytes
 )
$$;
revoke all on function public.ghostwriter_free_control_valid() from public,anon,authenticated;
grant execute on function public.ghostwriter_free_control_valid() to service_role;

-- Authenticated enrollment: one verified email, revocable, no finite recruiter pool.
create or replace function public.ghostwriter_free_entitle(p_account_id uuid,p_session_id uuid)
returns text language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s'
as $$ declare v_identity text; v_existing public.ghostwriter_portfolio_entitlements%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 if not public.ghostwriter_ai_session_active(p_account_id,p_session_id) then return 'session_revoked'; end if;
 if not exists(select 1 from public.ghostwriter_ai_control where singleton and release_profile='portfolio-free' and free_verified_at is not null and free_evidence_reference is not null) then return 'service_unavailable'; end if;
 select encode(sha256(convert_to(lower(btrim(email)),'UTF8')),'hex') into v_identity from auth.users where id=p_account_id and email_confirmed_at is not null;
 if v_identity is null then return 'unverified_identity'; end if;
 select * into v_existing from public.ghostwriter_portfolio_entitlements where account_id=p_account_id;
 if found then if v_existing.revoked_at is not null then return 'not_entitled'; end if; return 'entitled'; end if;
 if exists(select 1 from public.ghostwriter_portfolio_entitlements where identity_hash=v_identity) then return 'trial_already_claimed'; end if;
 insert into public.ghostwriter_portfolio_entitlements(account_id,identity_hash,claimed_at) values(p_account_id,v_identity,clock_timestamp());
 return 'entitled';
end $$;

create or replace function public.ghostwriter_free_entitle_bounded(p_account_id uuid,p_session_id uuid,p_accounts integer)
returns text language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$ begin
 if p_accounts is null or p_accounts not between 1 and 25 then return 'invalid_request'; end if;
 return public.ghostwriter_free_entitle(p_account_id,p_session_id);
end $$;

-- Authenticated base reservation: three rolling-24h starts, renewable forever.
create or replace function public.ghostwriter_free_reserve(p_account_id uuid,p_session_id uuid,p_idempotency_key text,p_request_fingerprint text,p_organization_id text,p_project_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s'
as $$ declare t timestamptz; day_start timestamptz; existing public.ghostwriter_ai_operations%rowtype; operation uuid; reason text; global_day integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 t:=clock_timestamp(); day_start:=(date_trunc('day',t at time zone 'UTC') at time zone 'UTC');
 if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,80}$' or p_request_fingerprint is null or p_request_fingerprint !~ '^[a-f0-9]{64}$' then return jsonb_build_object('kind','denied','reason','invalid_request'); end if;
 if not public.ghostwriter_ai_session_active(p_account_id,p_session_id) then return jsonb_build_object('kind','denied','reason','session_revoked'); end if;
 if not exists(select 1 from public.ghostwriter_portfolio_entitlements where account_id=p_account_id and revoked_at is null) then return jsonb_build_object('kind','denied','reason','not_entitled'); end if;
 select * into existing from public.ghostwriter_ai_operations where account_id=p_account_id and principal_kind='authenticated' and idempotency_key=p_idempotency_key;
 if found then
  if existing.profile<>'portfolio-free' or existing.request_fingerprint<>p_request_fingerprint then return jsonb_build_object('kind','conflict','operation_id',existing.id); end if;
  return jsonb_build_object('kind','replay','operation_id',existing.id,'state',existing.state,'outcome',existing.outcome,'result',case when existing.settled_at<=t-interval '7 days' then null else existing.result_json end);
 end if;
 if not public.ghostwriter_free_control_valid() or not exists(select 1 from public.ghostwriter_ai_control where free_organization_id=p_organization_id and free_project_id=p_project_id) then return jsonb_build_object('kind','denied','reason','service_paused'); end if;
 if exists(select 1 from public.ghostwriter_ai_operations where state='uncertain') then return jsonb_build_object('kind','denied','reason','unresolved_liability'); end if;
 select portfolio_global_daily_limit into global_day from public.ghostwriter_ai_control where singleton;
 select case
  when count(*) filter(where account_id=p_account_id and principal_kind='authenticated' and (dispatched_at>=t-interval '24 hours' or state='reserved'))>=3 then 'account_day_limit'
  when count(*) filter(where account_id=p_account_id and principal_kind='authenticated' and (dispatched_at>=t-interval '1 minute' or state='reserved'))>=3 then 'account_minute_limit'
  when count(*) filter(where profile='portfolio-free' and (dispatched_at>=day_start or state='reserved'))>=global_day then 'global_day_limit'
  when count(*) filter(where profile='portfolio-free' and (dispatched_at>=t-interval '1 minute' or state='reserved'))>=6 then 'global_minute_limit'
 end into reason from public.ghostwriter_ai_operations;
 if reason is not null then return jsonb_build_object('kind','denied','reason',reason); end if;
 if exists(select 1 from public.ghostwriter_ai_operations where state in ('reserved','dispatched','uncertain')) then return jsonb_build_object('kind','denied','reason','global_concurrency_limit'); end if;
 insert into public.ghostwriter_ai_operations(account_id,session_id,idempotency_key,request_fingerprint,pricing_version,reserved_micro_usd,profile,principal_kind)
 values(p_account_id,p_session_id,p_idempotency_key,p_request_fingerprint,'groq-openai-gpt-oss-20b-2026-09-07',750,'portfolio-free','authenticated') returning id into operation;
 return jsonb_build_object('kind','admitted','operation_id',operation);
end $$;

-- Bounded authenticated wrapper adds financial fences without reintroducing lifetime caps.
create or replace function public.ghostwriter_free_reserve_bounded(p_account_id uuid,p_session_id uuid,p_idempotency_key text,p_request_fingerprint text,p_organization_id text,p_project_id text,p_limits jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
declare ceilings jsonb; k text; v bigint; t timestamptz; month_start timestamptz; reason text; result jsonb; monthly_budget bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 if not public.ghostwriter_ai_session_active(p_account_id,p_session_id) then return jsonb_build_object('kind','denied','reason','session_revoked'); end if;
 select free_limits,portfolio_monthly_budget_micro_usd into ceilings,monthly_budget from public.ghostwriter_ai_control where singleton for update;
 if ceilings is null or p_limits is null or jsonb_typeof(p_limits)<>'object' or (select count(*) from jsonb_object_keys(p_limits))<>9 then return jsonb_build_object('kind','denied','reason','invalid_request'); end if;
 for k in select jsonb_object_keys(ceilings) loop
  if p_limits->>k is null or (p_limits->>k) !~ '^[0-9]{1,9}$' or (p_limits->>k)::bigint<1 then return jsonb_build_object('kind','denied','reason','invalid_request'); end if;
  v:=least((ceilings->>k)::bigint,(p_limits->>k)::bigint); ceilings:=jsonb_set(ceilings,array[k],to_jsonb(v));
 end loop;
 if exists(select 1 from public.ghostwriter_ai_operations where account_id=p_account_id and principal_kind='authenticated' and idempotency_key=p_idempotency_key) then
  result:=public.ghostwriter_free_reserve(p_account_id,p_session_id,p_idempotency_key,p_request_fingerprint,p_organization_id,p_project_id);
  if result->>'kind'='replay' and exists(select 1 from public.ghostwriter_ai_operations where id=(result->>'operation_id')::uuid and settled_at<=clock_timestamp()-interval '7 days') then result:=jsonb_set(result,'{result}','null'::jsonb); end if;
  return result;
 end if;
 if not exists(select 1 from public.ghostwriter_portfolio_entitlements where account_id=p_account_id and revoked_at is null) then return jsonb_build_object('kind','denied','reason','not_entitled'); end if;
 if not public.ghostwriter_free_control_valid() then return jsonb_build_object('kind','denied','reason','service_paused'); end if;
 if 750>(ceilings->>'operationBudget')::bigint then return jsonb_build_object('kind','denied','reason','operation_budget'); end if;
 t:=clock_timestamp(); month_start:=(date_trunc('month',t at time zone 'UTC') at time zone 'UTC');
 select case
  when coalesce(sum(case when state in ('reserved','dispatched','uncertain') then reserved_micro_usd else coalesce(actual_micro_usd,0) end) filter(where state in ('reserved','dispatched','uncertain') or settled_at>=t-interval '1 hour'),0)+750>(ceilings->>'hourBudget')::bigint then 'hour_budget'
  when coalesce(sum(case when state in ('reserved','dispatched','uncertain') then reserved_micro_usd else coalesce(actual_micro_usd,0) end) filter(where state in ('reserved','dispatched','uncertain') or settled_at>=t-interval '24 hours'),0)+750>(ceilings->>'dayBudget')::bigint then 'day_budget'
  when coalesce(sum(case when state in ('reserved','dispatched','uncertain') then reserved_micro_usd else coalesce(actual_micro_usd,0) end) filter(where state in ('reserved','dispatched','uncertain') or settled_at>=month_start),0)+750>monthly_budget then 'month_budget'
 end into reason from public.ghostwriter_ai_operations;
 if reason is not null then return jsonb_build_object('kind','denied','reason',reason); end if;
 return public.ghostwriter_free_reserve(p_account_id,p_session_id,p_idempotency_key,p_request_fingerprint,p_organization_id,p_project_id);
end $$;

-- Anonymous recruiter admission: stable signed UUID, three UTC-day starts, shared hard caps.
create function public.ghostwriter_anonymous_reserve_bounded(p_visitor_id uuid,p_idempotency_key text,p_request_fingerprint text,p_organization_id text,p_project_id text,p_limits jsonb,p_global_daily_limit integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
declare ceilings jsonb; k text; v bigint; t timestamptz; day_start timestamptz; month_start timestamptz; existing public.ghostwriter_ai_operations%rowtype; operation uuid; reason text; global_day integer; visitor_day integer; monthly_budget bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 t:=clock_timestamp();day_start:=(date_trunc('day',t at time zone 'UTC') at time zone 'UTC');month_start:=(date_trunc('month',t at time zone 'UTC') at time zone 'UTC');
 if p_visitor_id is null or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,80}$' or p_request_fingerprint is null or p_request_fingerprint !~ '^[a-f0-9]{64}$' then return jsonb_build_object('kind','denied','reason','invalid_request'); end if;
 select free_limits,portfolio_monthly_budget_micro_usd into ceilings,monthly_budget from public.ghostwriter_ai_control where singleton for update;
 if ceilings is null or p_limits is null or jsonb_typeof(p_limits)<>'object' or (select count(*) from jsonb_object_keys(p_limits))<>9 then return jsonb_build_object('kind','denied','reason','invalid_request'); end if;
 for k in select jsonb_object_keys(ceilings) loop if p_limits->>k is null or (p_limits->>k) !~ '^[0-9]{1,9}$' or (p_limits->>k)::bigint<1 then return jsonb_build_object('kind','denied','reason','invalid_request'); end if; v:=least((ceilings->>k)::bigint,(p_limits->>k)::bigint); ceilings:=jsonb_set(ceilings,array[k],to_jsonb(v)); end loop;
 if p_global_daily_limit is null or p_global_daily_limit not between 1 and 100 then return jsonb_build_object('kind','denied','reason','invalid_request'); end if;
 select least(portfolio_global_daily_limit,p_global_daily_limit),least(3,(ceilings->>'accountDay')::integer) into global_day,visitor_day from public.ghostwriter_ai_control where singleton;
 select * into existing from public.ghostwriter_ai_operations where account_id=p_visitor_id and principal_kind='anonymous' and idempotency_key=p_idempotency_key;
 if found then if existing.profile<>'portfolio-free' or existing.request_fingerprint<>p_request_fingerprint then return jsonb_build_object('kind','conflict','operation_id',existing.id); end if; return jsonb_build_object('kind','replay','operation_id',existing.id,'state',existing.state,'outcome',existing.outcome,'result',case when existing.settled_at<=t-interval '7 days' then null else existing.result_json end); end if;
 if not public.ghostwriter_free_control_valid() or not exists(select 1 from public.ghostwriter_ai_control where free_organization_id=p_organization_id and free_project_id=p_project_id) then return jsonb_build_object('kind','denied','reason','service_paused'); end if;
 if exists(select 1 from public.ghostwriter_ai_operations where state='uncertain') then return jsonb_build_object('kind','denied','reason','unresolved_liability'); end if;
 select case
  when count(*) filter(where account_id=p_visitor_id and principal_kind='anonymous' and profile='portfolio-free' and (dispatched_at>=day_start or state='reserved'))>=visitor_day then 'anonymous_day_limit'
  when count(*) filter(where account_id=p_visitor_id and principal_kind='anonymous' and profile='portfolio-free' and (dispatched_at>=t-interval '1 minute' or state='reserved'))>=least(3,(ceilings->>'accountMinute')::integer) then 'account_minute_limit'
  when count(*) filter(where profile='portfolio-free' and (dispatched_at>=day_start or state='reserved'))>=global_day then 'global_day_limit'
  when count(*) filter(where profile='portfolio-free' and (dispatched_at>=t-interval '1 minute' or state='reserved'))>=(ceilings->>'globalMinute')::integer then 'global_minute_limit'
 end into reason from public.ghostwriter_ai_operations;
 if reason is not null then return jsonb_build_object('kind','denied','reason',reason); end if;
 if 750>(ceilings->>'operationBudget')::bigint then return jsonb_build_object('kind','denied','reason','operation_budget'); end if;
 select case
  when coalesce(sum(case when state in ('reserved','dispatched','uncertain') then reserved_micro_usd else coalesce(actual_micro_usd,0) end) filter(where state in ('reserved','dispatched','uncertain') or settled_at>=t-interval '1 hour'),0)+750>(ceilings->>'hourBudget')::bigint then 'hour_budget'
  when coalesce(sum(case when state in ('reserved','dispatched','uncertain') then reserved_micro_usd else coalesce(actual_micro_usd,0) end) filter(where state in ('reserved','dispatched','uncertain') or settled_at>=t-interval '24 hours'),0)+750>(ceilings->>'dayBudget')::bigint then 'day_budget'
  when coalesce(sum(case when state in ('reserved','dispatched','uncertain') then reserved_micro_usd else coalesce(actual_micro_usd,0) end) filter(where state in ('reserved','dispatched','uncertain') or settled_at>=month_start),0)+750>monthly_budget then 'month_budget'
 end into reason from public.ghostwriter_ai_operations;
 if reason is not null then return jsonb_build_object('kind','denied','reason',reason); end if;
 if exists(select 1 from public.ghostwriter_ai_operations where state in ('reserved','dispatched','uncertain')) then return jsonb_build_object('kind','denied','reason','global_concurrency_limit'); end if;
 insert into public.ghostwriter_ai_operations(account_id,session_id,idempotency_key,request_fingerprint,pricing_version,reserved_micro_usd,profile,principal_kind) values(p_visitor_id,null,p_idempotency_key,p_request_fingerprint,'groq-openai-gpt-oss-20b-2026-09-07',750,'portfolio-free','anonymous') returning id into operation;
 return jsonb_build_object('kind','admitted','operation_id',operation);
end $$;

create function public.ghostwriter_anonymous_allowance(p_visitor_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
declare t timestamptz:=clock_timestamp(); day_start timestamptz; used integer; global_used integer; global_day integer;
begin day_start:=(date_trunc('day',t at time zone 'UTC') at time zone 'UTC');select count(*) filter(where dispatched_at>=day_start or state='reserved') into used from public.ghostwriter_ai_operations where account_id=p_visitor_id and principal_kind='anonymous' and profile='portfolio-free';select count(*) filter(where dispatched_at>=day_start or state='reserved') into global_used from public.ghostwriter_ai_operations where profile='portfolio-free';select portfolio_global_daily_limit into global_day from public.ghostwriter_ai_control where singleton;return jsonb_build_object('remaining',greatest(0,3-used),'todayRemaining',greatest(0,3-used),'available',public.ghostwriter_free_control_valid() and global_used<global_day and not exists(select 1 from public.ghostwriter_ai_operations where state='uncertain'));end $$;

create function public.ghostwriter_portfolio_allowance(p_account_id uuid,p_session_id uuid,p_principal_kind text)
returns jsonb language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
declare t timestamptz:=clock_timestamp(); used integer; remaining integer; global_used integer; global_day integer; day_start timestamptz;
begin if p_principal_kind<>'authenticated' then return null; end if;if not public.ghostwriter_ai_session_active(p_account_id,p_session_id) then return null; end if;if not exists(select 1 from public.ghostwriter_portfolio_entitlements where account_id=p_account_id and revoked_at is null) then return jsonb_build_object('remaining',0,'todayRemaining',0,'available',false); end if;select count(*) filter(where dispatched_at>=t-interval '24 hours' or state='reserved') into used from public.ghostwriter_ai_operations where account_id=p_account_id and principal_kind='authenticated' and profile='portfolio-free';remaining:=greatest(0,3-used);day_start:=(date_trunc('day',t at time zone 'UTC') at time zone 'UTC');select count(*) filter(where dispatched_at>=day_start or state='reserved') into global_used from public.ghostwriter_ai_operations where profile='portfolio-free';select portfolio_global_daily_limit into global_day from public.ghostwriter_ai_control where singleton;return jsonb_build_object('remaining',remaining,'todayRemaining',remaining,'available',public.ghostwriter_free_control_valid() and global_used<global_day and not exists(select 1 from public.ghostwriter_ai_operations where state='uncertain'));end $$;

create or replace function public.ghostwriter_free_allowance(p_account_id uuid,p_session_id uuid)
returns jsonb language sql security definer set search_path=pg_catalog set statement_timeout='3s' as $$ select public.ghostwriter_portfolio_allowance(p_account_id,p_session_id,'authenticated') $$;
create function public.ghostwriter_portfolio_entitle(p_account_id uuid,p_session_id uuid,p_accounts integer)
returns text language sql security definer set search_path=pg_catalog set statement_timeout='3s' as $$ select case when p_accounts between 1 and 25 then public.ghostwriter_free_entitle(p_account_id,p_session_id) else 'invalid_request' end $$;

-- Preserve authenticated dispatch; add only a tightly fenced anonymous branch.
alter function public.ghostwriter_ai_mark_dispatched(uuid,uuid) rename to ghostwriter_mark_dispatched_before_anonymous;
revoke all on function public.ghostwriter_mark_dispatched_before_anonymous(uuid,uuid) from public,anon,authenticated,service_role;
create function public.ghostwriter_ai_mark_dispatched(p_operation_id uuid,p_account_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
declare kind text;begin perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));select principal_kind into kind from public.ghostwriter_ai_operations where id=p_operation_id and account_id=p_account_id;if kind='anonymous' then if not public.ghostwriter_free_control_valid() or exists(select 1 from public.ghostwriter_ai_operations where state='uncertain') then return false; end if;update public.ghostwriter_ai_operations set state='dispatched',dispatched_at=clock_timestamp(),updated_at=clock_timestamp() where id=p_operation_id and account_id=p_account_id and principal_kind='anonymous' and profile='portfolio-free' and session_id is null and state='reserved' and created_at>clock_timestamp()-interval '30 seconds';return found;end if;return public.ghostwriter_mark_dispatched_before_anonymous(p_operation_id,p_account_id);end $$;

-- Retention redacts content, but never deletes accounting rows or auto-retires on a date.
create or replace function public.ghostwriter_retention_redaction() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$ begin if exists(select 1 from public.ghostwriter_lifecycle where singleton and retired_at is not null) or new.settled_at<=clock_timestamp()-interval '7 days' then new.result_json:=null; end if; return new; end $$;
create or replace function public.ghostwriter_retention_maintenance() returns jsonb
language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
declare expired integer;begin perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));with batch as(select id from public.ghostwriter_ai_operations where result_json is not null and settled_at<=clock_timestamp()-interval '7 days' order by settled_at nulls first,id limit 100 for update)update public.ghostwriter_ai_operations o set result_json=null from batch b where o.id=b.id;get diagnostics expired=row_count;delete from public.ghostwriter_used_challenges where ctid in(select ctid from public.ghostwriter_used_challenges where expires_at<clock_timestamp() limit 100);delete from public.ghostwriter_abuse_counters where ctid in(select ctid from public.ghostwriter_abuse_counters where window_start+window_ms*interval '1 millisecond'<clock_timestamp() limit 100);delete from public.ghostwriter_abuse_penalties where ctid in(select ctid from public.ghostwriter_abuse_penalties where blocked_until<clock_timestamp() and updated_at<clock_timestamp()-interval '1 day' limit 100);if to_regclass('cron.job_run_details') is not null then execute 'delete from cron.job_run_details where runid in(select r.runid from cron.job_run_details r join cron.job j on j.jobid=r.jobid where j.jobname=''ghostwriter-retention'' and r.end_time<clock_timestamp()-interval ''7 days'' order by r.end_time limit 100)';end if;update public.ghostwriter_lifecycle set last_maintenance_at=clock_timestamp();return jsonb_build_object('expiredPayloads',expired,'serviceRetired',false);end $$;

create function public.ghostwriter_portfolio_health() returns jsonb
language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
declare bytes bigint;warn_bytes bigint;hard_bytes bigint;last_maintenance timestamptz;cron_active boolean:=false;begin select pg_database_size(current_database()),database_warn_bytes,database_hard_bytes into bytes,warn_bytes,hard_bytes from public.ghostwriter_ai_control where singleton;select last_maintenance_at into last_maintenance from public.ghostwriter_lifecycle where singleton;if to_regclass('cron.job') is not null then execute 'select exists(select 1 from cron.job where jobname=''ghostwriter-retention'' and active)' into cron_active;end if;return jsonb_build_object('databaseBytes',bytes,'databaseWarnBytes',warn_bytes,'databaseHardBytes',hard_bytes,'databaseWarning',bytes>=warn_bytes,'databaseHardLimit',bytes>=hard_bytes,'lastMaintenanceAt',last_maintenance,'cronActive',cron_active,'releaseActive',public.ghostwriter_release_active(),'controlValid',public.ghostwriter_free_control_valid());end $$;
create function public.ghostwriter_portfolio_heartbeat() returns jsonb
language plpgsql security definer set search_path=pg_catalog set statement_timeout='5s' as $$
declare health jsonb;begin perform public.ghostwriter_retention_maintenance();health:=public.ghostwriter_portfolio_health();if coalesce((health->>'databaseHardLimit')::boolean,false) then perform public.ghostwriter_ai_pause('database_size_hard_limit');health:=jsonb_set(health,'{controlValid}','false'::jsonb);end if;return health;end $$;

revoke all on function public.ghostwriter_anonymous_reserve_bounded(uuid,text,text,text,text,jsonb,integer),public.ghostwriter_anonymous_allowance(uuid),public.ghostwriter_portfolio_allowance(uuid,uuid,text),public.ghostwriter_portfolio_entitle(uuid,uuid,integer),public.ghostwriter_portfolio_health(),public.ghostwriter_portfolio_heartbeat(),public.ghostwriter_ai_mark_dispatched(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ghostwriter_anonymous_reserve_bounded(uuid,text,text,text,text,jsonb,integer),public.ghostwriter_anonymous_allowance(uuid),public.ghostwriter_portfolio_allowance(uuid,uuid,text),public.ghostwriter_portfolio_entitle(uuid,uuid,integer),public.ghostwriter_portfolio_health(),public.ghostwriter_portfolio_heartbeat(),public.ghostwriter_ai_mark_dispatched(uuid,uuid) to service_role;
