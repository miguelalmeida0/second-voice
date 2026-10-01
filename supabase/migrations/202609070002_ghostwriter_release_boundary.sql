-- Forward correction: preserve history; migration never enables AI.
create table public.ghostwriter_ai_control (
 singleton boolean primary key default true check(singleton),
 paused boolean not null default true,
 valid_until timestamptz not null default '-infinity',
 reason text not null default 'migration_requires_review' check(length(reason) between 1 and 240),
 updated_at timestamptz not null default clock_timestamp()
);
insert into public.ghostwriter_ai_control(singleton) values(true);
create table public.ghostwriter_revoked_sessions (
 session_id uuid primary key, account_id uuid not null,
 revoked_at timestamptz not null default clock_timestamp()
);
alter table public.ghostwriter_ai_operations add column session_id uuid;
alter table public.ghostwriter_ai_operations add column observed_micro_usd bigint check(observed_micro_usd>=0);
alter table public.ghostwriter_ai_control enable row level security;
alter table public.ghostwriter_revoked_sessions enable row level security;
revoke all on public.ghostwriter_ai_control,public.ghostwriter_revoked_sessions,public.ghostwriter_ai_operations,public.ghostwriter_beta_entitlements from public,anon,authenticated,service_role;
create or replace function public.ghostwriter_ai_session_active(p_account_id uuid,p_session_id uuid)
returns boolean language sql security definer set search_path=pg_catalog set statement_timeout='3s'
as $$ select p_session_id is not null and exists(
 select 1 from auth.sessions s join auth.users u on u.id=s.user_id
 where s.id=p_session_id and s.user_id=p_account_id
 and (s.not_after is null or s.not_after>clock_timestamp())
 and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=clock_timestamp())
) and not exists(select 1 from public.ghostwriter_revoked_sessions where session_id=p_session_id) $$;
create or replace function public.ghostwriter_ai_revoke_session(p_account_id uuid,p_session_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s'
as $$ begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 if not exists(select 1 from auth.sessions where id=p_session_id and user_id=p_account_id) then return false; end if;
 insert into public.ghostwriter_revoked_sessions(session_id,account_id) values(p_session_id,p_account_id) on conflict do nothing;
 return true;
end $$;
create or replace function public.ghostwriter_ai_reserve(
  p_account_id uuid,
  p_session_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_pricing_version text,
  p_reservation_micro_usd bigint,
  p_max_approved_accounts integer,
  p_account_lifetime_limit integer,
  p_account_day_limit integer,
  p_account_minute_limit integer,
  p_account_concurrency_limit integer,
  p_global_minute_limit integer,
  p_global_concurrency_limit integer,
  p_hour_budget_micro_usd bigint,
  p_day_budget_micro_usd bigint,
  p_beta_lifetime_budget_micro_usd bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
set statement_timeout = '3s'
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_existing public.ghostwriter_ai_operations%rowtype;
  v_entitlement public.ghostwriter_beta_entitlements%rowtype;
  v_operation_id uuid;
  v_count bigint;
  v_spend bigint;
begin
  -- The initial beta is deliberately serialized globally. With a 10 RPM service
  -- ceiling this is a small, bounded critical section and closes every race.
  perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1', 0));

  v_now := clock_timestamp();
  if not public.ghostwriter_ai_session_active(p_account_id,p_session_id) then
    return jsonb_build_object('kind','denied','reason','session_revoked');
  end if;
  if not exists(select 1 from public.ghostwriter_ai_control where singleton and not paused and valid_until>v_now) then
    return jsonb_build_object('kind','denied','reason','service_paused');
  end if;
  if exists(select 1 from public.ghostwriter_ai_operations where state='uncertain') then
    return jsonb_build_object('kind','denied','reason','unresolved_liability');
  end if;
  if not exists(select 1 from public.ghostwriter_beta_entitlements where account_id=p_account_id and revoked_at is null and (expires_at is null or expires_at>v_now)) then
    return jsonb_build_object('kind','denied','reason','not_entitled');
  end if;
  select *
    into v_existing
  from public.ghostwriter_ai_operations
  where account_id = p_account_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint then
      return jsonb_build_object(
        'kind', 'conflict',
        'operation_id', v_existing.id
      );
    end if;

    return jsonb_build_object(
      'kind', 'replay',
      'operation_id', v_existing.id,
      'state', v_existing.state,
      'outcome', v_existing.outcome,
      'result', v_existing.result_json
    );
  end if;

  if
    p_idempotency_key is null
    or p_request_fingerprint is null
    or p_reservation_micro_usd is null
    or p_max_approved_accounts is null
    or p_account_lifetime_limit is null
    or p_account_day_limit is null
    or p_account_minute_limit is null
    or p_account_concurrency_limit is null
    or p_global_minute_limit is null
    or p_global_concurrency_limit is null
    or p_hour_budget_micro_usd is null
    or p_day_budget_micro_usd is null
    or p_beta_lifetime_budget_micro_usd is null
    or p_pricing_version <> 'groq-openai-gpt-oss-20b-2026-09-07'
    or p_reservation_micro_usd <> 750
    or p_account_id is null
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,80}$'
    or p_request_fingerprint !~ '^[a-f0-9]{64}$'
    or p_pricing_version is null
    or length(p_pricing_version) not between 1 and 120
    or p_reservation_micro_usd not between 1 and 10000
    or p_max_approved_accounts not between 1 and 25
    or p_account_lifetime_limit not between 1 and 10
    or p_account_day_limit not between 1 and 5
    or p_account_minute_limit not between 1 and 3
    or p_account_concurrency_limit <> 1
    or p_global_minute_limit not between 1 and 10
    or p_global_concurrency_limit not between 1 and 2
    or p_hour_budget_micro_usd < p_reservation_micro_usd
    or p_hour_budget_micro_usd > 500000
    or p_day_budget_micro_usd < p_hour_budget_micro_usd
    or p_day_budget_micro_usd > 2000000
    or p_beta_lifetime_budget_micro_usd < p_day_budget_micro_usd
    or p_beta_lifetime_budget_micro_usd > 10000000
  then
    return jsonb_build_object('kind', 'denied', 'reason', 'invalid_request');
  end if;

  select *
    into v_entitlement
  from public.ghostwriter_beta_entitlements
  where account_id = p_account_id;

  if not found or v_entitlement.revoked_at is not null then
    return jsonb_build_object('kind', 'denied', 'reason', 'not_entitled');
  end if;

  if v_entitlement.expires_at is not null and v_entitlement.expires_at <= v_now then
    return jsonb_build_object('kind', 'denied', 'reason', 'entitlement_expired');
  end if;

  if v_entitlement.approved_slot > p_max_approved_accounts then
    return jsonb_build_object('kind', 'denied', 'reason', 'entitlement_capacity_limit');
  end if;

  select count(*)
    into v_count
  from public.ghostwriter_ai_operations
  where account_id = p_account_id;
  if v_count >= p_account_lifetime_limit then
    return jsonb_build_object('kind', 'denied', 'reason', 'account_lifetime_limit');
  end if;

  select count(*)
    into v_count
  from public.ghostwriter_ai_operations
  where account_id = p_account_id
    and created_at >= v_now - interval '24 hours';
  if v_count >= p_account_day_limit then
    return jsonb_build_object('kind', 'denied', 'reason', 'account_day_limit');
  end if;

  select count(*)
    into v_count
  from public.ghostwriter_ai_operations
  where account_id = p_account_id
    and created_at >= v_now - interval '1 minute';
  if v_count >= p_account_minute_limit then
    return jsonb_build_object('kind', 'denied', 'reason', 'account_minute_limit');
  end if;

  select count(*)
    into v_count
  from public.ghostwriter_ai_operations
  where account_id = p_account_id
    and state in ('reserved', 'dispatched', 'uncertain');
  if v_count >= p_account_concurrency_limit then
    return jsonb_build_object('kind', 'denied', 'reason', 'account_concurrency_limit');
  end if;

  select count(*)
    into v_count
  from public.ghostwriter_ai_operations
  where created_at >= v_now - interval '1 minute';
  if v_count >= p_global_minute_limit then
    return jsonb_build_object('kind', 'denied', 'reason', 'global_minute_limit');
  end if;

  select count(*)
    into v_count
  from public.ghostwriter_ai_operations
  where state in ('reserved', 'dispatched', 'uncertain');
  if v_count >= p_global_concurrency_limit then
    return jsonb_build_object('kind', 'denied', 'reason', 'global_concurrency_limit');
  end if;

  select coalesce(sum(
    case
      when state in ('reserved', 'dispatched', 'uncertain') then reserved_micro_usd
      else coalesce(actual_micro_usd, 0)
    end
  ), 0)
    into v_spend
  from public.ghostwriter_ai_operations
  where state in ('reserved','dispatched','uncertain') or settled_at >= v_now - interval '1 hour';
  if v_spend + p_reservation_micro_usd > p_hour_budget_micro_usd then
    return jsonb_build_object('kind', 'denied', 'reason', 'hour_budget');
  end if;

  select coalesce(sum(
    case
      when state in ('reserved', 'dispatched', 'uncertain') then reserved_micro_usd
      else coalesce(actual_micro_usd, 0)
    end
  ), 0)
    into v_spend
  from public.ghostwriter_ai_operations
  where state in ('reserved','dispatched','uncertain') or settled_at >= v_now - interval '24 hours';
  if v_spend + p_reservation_micro_usd > p_day_budget_micro_usd then
    return jsonb_build_object('kind', 'denied', 'reason', 'day_budget');
  end if;

  select coalesce(sum(
    case
      when state in ('reserved', 'dispatched', 'uncertain') then reserved_micro_usd
      else coalesce(actual_micro_usd, 0)
    end
  ), 0)
    into v_spend
  from public.ghostwriter_ai_operations;
  if v_spend + p_reservation_micro_usd > p_beta_lifetime_budget_micro_usd then
    return jsonb_build_object('kind', 'denied', 'reason', 'beta_lifetime_budget');
  end if;

  insert into public.ghostwriter_ai_operations (
    account_id,
    session_id,
    idempotency_key,
    pricing_version,
    request_fingerprint,
    reserved_micro_usd,
    state,
    created_at,
    updated_at
  )
  values (
    p_account_id,
    p_session_id,
    p_idempotency_key,
    p_pricing_version,
    p_request_fingerprint,
    p_reservation_micro_usd,
    'reserved',
    v_now,
    v_now
  )
  returning id into v_operation_id;

  return jsonb_build_object('kind', 'admitted', 'operation_id', v_operation_id);
end;
$$;


create or replace function public.ghostwriter_ai_mark_dispatched(p_operation_id uuid,p_account_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s'
as $$ begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 if not exists(select 1 from public.ghostwriter_ai_control where singleton and not paused and valid_until>clock_timestamp()) then return false; end if;
 if exists(select 1 from public.ghostwriter_ai_operations where state='uncertain') then return false; end if;
 update public.ghostwriter_ai_operations o set state='dispatched',dispatched_at=clock_timestamp(),updated_at=clock_timestamp()
 where o.id=p_operation_id and o.account_id=p_account_id and o.state='reserved'
 and o.created_at>clock_timestamp()-interval '30 seconds'
 and public.ghostwriter_ai_session_active(o.account_id,o.session_id)
 and exists(select 1 from public.ghostwriter_beta_entitlements e where e.account_id=o.account_id and e.revoked_at is null and (e.expires_at is null or e.expires_at>clock_timestamp()));
 return found;
end $$;
create or replace function public.ghostwriter_ai_fail_before_dispatch(p_operation_id uuid,p_account_id uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s'
as $$ begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 update public.ghostwriter_ai_operations set state='failed',outcome='failed',actual_micro_usd=0,settled_at=clock_timestamp(),updated_at=clock_timestamp(),failure_code=left(p_reason,120)
 where id=p_operation_id and account_id=p_account_id and state='reserved';
 return found;
end $$;
create or replace function public.ghostwriter_ai_pause(p_reason text)
returns boolean language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s'
as $$ begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 if p_reason is null or length(p_reason) not between 1 and 240 then return false; end if;
 update public.ghostwriter_ai_control set paused=true,reason=p_reason,updated_at=clock_timestamp();
 return found;
end $$;
create or replace function public.ghostwriter_ai_report_anomaly(p_operation_id uuid,p_account_id uuid,p_observed_micro_usd bigint)
returns boolean language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s'
as $$ begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 perform public.ghostwriter_ai_pause('unreconciled_provider_usage');
 update public.ghostwriter_ai_operations set state='uncertain',observed_micro_usd=greatest(observed_micro_usd,p_observed_micro_usd),updated_at=clock_timestamp()
 where id=p_operation_id and account_id=p_account_id and state in ('dispatched','uncertain') and (p_observed_micro_usd is null or p_observed_micro_usd>=0);
 return found;
end $$;
revoke all on function public.ghostwriter_ai_reserve(uuid,text,text,text,bigint,integer,integer,integer,integer,integer,integer,integer,bigint,bigint,bigint) from service_role;
revoke all on function public.ghostwriter_ai_reconcile_uncertain(uuid,bigint,text,text) from service_role;
revoke all on function public.ghostwriter_ai_expire_result_payloads(timestamptz) from service_role;
revoke all on function public.ghostwriter_ai_session_active(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ghostwriter_ai_session_active(uuid,uuid) to service_role;
revoke all on function public.ghostwriter_ai_revoke_session(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ghostwriter_ai_revoke_session(uuid,uuid) to service_role;
revoke all on function public.ghostwriter_ai_pause(text) from public,anon,authenticated;
grant execute on function public.ghostwriter_ai_pause(text) to service_role;
revoke all on function public.ghostwriter_ai_report_anomaly(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.ghostwriter_ai_report_anomaly(uuid,uuid,bigint) to service_role;
revoke all on function public.ghostwriter_ai_reserve(uuid,uuid,text,text,text,bigint,integer,integer,integer,integer,integer,integer,integer,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.ghostwriter_ai_reserve(uuid,uuid,text,text,text,bigint,integer,integer,integer,integer,integer,integer,integer,bigint,bigint,bigint) to service_role;
create or replace function public.ghostwriter_ai_settle_success(
  p_operation_id uuid,
  p_account_id uuid,
  p_actual_micro_usd bigint,
  p_provider_request_id text,
  p_result jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
set statement_timeout = '3s'
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
  if
    p_actual_micro_usd is null or p_actual_micro_usd < 0
    or p_provider_request_id is not null and length(p_provider_request_id) > 256
    or p_result is null
    or octet_length(p_result::text) > 16384
  then
    return false;
  end if;

  update public.ghostwriter_ai_operations
  set
    actual_micro_usd = p_actual_micro_usd,
    failure_code = null,
    outcome = 'succeeded',
    provider_request_id = p_provider_request_id,
    result_json = p_result,
    state = 'settled',
    settled_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where id = p_operation_id
    and account_id = p_account_id
    and state = 'dispatched'
    and p_actual_micro_usd <= reserved_micro_usd;

  return found;
end;
$$;
