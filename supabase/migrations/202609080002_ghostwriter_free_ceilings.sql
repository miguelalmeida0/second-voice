-- Shared ceilings only tighten. A stale worker cannot widen a stricter review.
alter table public.ghostwriter_ai_control add column free_limits jsonb not null default
 '{"accounts":25,"accountLifetime":10,"accountDay":3,"accountMinute":1,"globalMinute":2,"hourBudget":500000,"dayBudget":2000000,"lifetimeBudget":10000000,"operationBudget":10000}'::jsonb;
create function public.ghostwriter_free_reserve_bounded(p_account_id uuid,p_session_id uuid,p_idempotency_key text,p_request_fingerprint text,p_organization_id text,p_project_id text,p_limits jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
declare ceilings jsonb; k text; v bigint; t timestamptz; reason text; result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 if not public.ghostwriter_ai_session_active(p_account_id,p_session_id) then return jsonb_build_object('kind','denied','reason','session_revoked'); end if;
 select free_limits into ceilings from public.ghostwriter_ai_control where singleton for update;
 if ceilings is null or p_limits is null or jsonb_typeof(p_limits)<>'object' or (select count(*) from jsonb_object_keys(p_limits))<>9 then return jsonb_build_object('kind','denied','reason','invalid_request'); end if;
 for k in select jsonb_object_keys(ceilings) loop
  if p_limits->>k is null or (p_limits->>k) !~ '^[0-9]{1,9}$' or (p_limits->>k)::bigint<1 then return jsonb_build_object('kind','denied','reason','invalid_request'); end if;
  v:=least((ceilings->>k)::bigint,(p_limits->>k)::bigint);
  ceilings:=jsonb_set(ceilings,array[k],to_jsonb(v));
 end loop;
 update public.ghostwriter_ai_control set free_limits=ceilings where singleton;
 -- Replay remains possible while paused and after a limit tightens. It never
 -- authorizes dispatch, and the original RPC verifies account/fingerprint.
 if exists(select 1 from public.ghostwriter_ai_operations where account_id=p_account_id and idempotency_key=p_idempotency_key) then
  return public.ghostwriter_free_reserve(p_account_id,p_session_id,p_idempotency_key,p_request_fingerprint,p_organization_id,p_project_id);
 end if;
 if not exists(select 1 from public.ghostwriter_beta_entitlements where account_id=p_account_id and approved_slot <= (ceilings->>'accounts')::integer) then return jsonb_build_object('kind','denied','reason','not_entitled'); end if;
 t:=clock_timestamp();
 select case
 when count(*) filter(where account_id=p_account_id and (dispatched_at is not null or state='reserved')) >= (ceilings->>'accountLifetime')::integer then 'account_lifetime_limit'
 when count(*) filter(where account_id=p_account_id and (dispatched_at>=t-interval '24 hours' or state='reserved')) >= (ceilings->>'accountDay')::integer then 'account_day_limit'
 when count(*) filter(where account_id=p_account_id and (dispatched_at>=t-interval '1 minute' or state='reserved')) >= (ceilings->>'accountMinute')::integer then 'account_minute_limit'
 when count(*) filter(where dispatched_at>=t-interval '1 minute' or state='reserved') >= (ceilings->>'globalMinute')::integer then 'global_minute_limit'
 end into reason from public.ghostwriter_ai_operations;
 if reason is not null then return jsonb_build_object('kind','denied','reason',reason); end if;
 if 750>(ceilings->>'operationBudget')::bigint then return jsonb_build_object('kind','denied','reason','operation_budget'); end if;
 select case
 when coalesce(sum(case when state in ('reserved','dispatched','uncertain') then reserved_micro_usd else coalesce(actual_micro_usd,0) end) filter(where state in ('reserved','dispatched','uncertain') or settled_at>=t-interval '1 hour'),0)+750>(ceilings->>'hourBudget')::bigint then 'hour_budget'
 when coalesce(sum(case when state in ('reserved','dispatched','uncertain') then reserved_micro_usd else coalesce(actual_micro_usd,0) end) filter(where state in ('reserved','dispatched','uncertain') or settled_at>=t-interval '24 hours'),0)+750>(ceilings->>'dayBudget')::bigint then 'day_budget'
 when coalesce(sum(case when state in ('reserved','dispatched','uncertain') then reserved_micro_usd else coalesce(actual_micro_usd,0) end),0)+750>(ceilings->>'lifetimeBudget')::bigint then 'beta_lifetime_budget'
 end into reason from public.ghostwriter_ai_operations;
 if reason is not null then return jsonb_build_object('kind','denied','reason',reason); end if;
 return public.ghostwriter_free_reserve(p_account_id,p_session_id,p_idempotency_key,p_request_fingerprint,p_organization_id,p_project_id);
end $$;
revoke all on function public.ghostwriter_free_reserve(uuid,uuid,text,text,text,text) from service_role;
revoke all on function public.ghostwriter_free_reserve_bounded(uuid,uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ghostwriter_free_reserve_bounded(uuid,uuid,text,text,text,text,jsonb) to service_role;

create function public.ghostwriter_free_entitle_bounded(p_account_id uuid,p_session_id uuid,p_accounts integer)
returns text language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
declare ceiling integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 if p_accounts is null or p_accounts not between 1 and 25 then return 'invalid_request'; end if;
 if not public.ghostwriter_ai_session_active(p_account_id,p_session_id) then return 'session_revoked'; end if;
 select least((free_limits->>'accounts')::integer,p_accounts) into ceiling from public.ghostwriter_ai_control where singleton for update;
 if ceiling is null then return 'service_paused'; end if;
 update public.ghostwriter_ai_control set free_limits=jsonb_set(free_limits,'{accounts}',to_jsonb(ceiling)) where singleton;
 if exists(select 1 from public.ghostwriter_beta_entitlements where account_id=p_account_id and approved_slot>ceiling) then return 'trial_capacity'; end if;
 if not exists(select 1 from public.ghostwriter_beta_entitlements where account_id=p_account_id) and
   (select count(*) from public.ghostwriter_beta_entitlements)>=ceiling then return 'trial_capacity'; end if;
 return public.ghostwriter_free_entitle(p_account_id,p_session_id);
end $$;
revoke all on function public.ghostwriter_free_entitle(uuid,uuid) from service_role;
revoke all on function public.ghostwriter_free_entitle_bounded(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.ghostwriter_free_entitle_bounded(uuid,uuid,integer) to service_role;

create or replace function public.ghostwriter_free_allowance(p_account_id uuid,p_session_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
declare limits jsonb; t timestamptz:=clock_timestamp();
begin
 if not public.ghostwriter_ai_session_active(p_account_id,p_session_id) then return null; end if;
 select free_limits into limits from public.ghostwriter_ai_control where singleton;
 if limits is null or not exists(select 1 from public.ghostwriter_beta_entitlements where account_id=p_account_id and free_claimed_at is not null and revoked_at is null and (expires_at is null or expires_at>t) and approved_slot<=(limits->>'accounts')::integer) then return jsonb_build_object('remaining',0,'available',false); end if;
 return (select jsonb_build_object('remaining',greatest(0,(limits->>'accountLifetime')::integer-count(*) filter(where dispatched_at is not null or state='reserved')),
 'todayRemaining',greatest(0,(limits->>'accountDay')::integer-count(*) filter(where dispatched_at>=t-interval '24 hours' or state='reserved')),
 'available',public.ghostwriter_free_control_valid()) from public.ghostwriter_ai_operations where account_id=p_account_id and profile='portfolio-free');
end $$;
