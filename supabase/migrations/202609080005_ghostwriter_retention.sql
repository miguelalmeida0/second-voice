-- Owner-approved finite trial: 7-day content / 90-day recovery retention.
-- No activation, usage reset, Auth deletion or legacy public-record erasure.
create table public.ghostwriter_lifecycle (
 singleton boolean primary key default true check(singleton),
 created_at timestamptz not null default clock_timestamp(),
 retire_at timestamptz not null default clock_timestamp()+interval '90 days',
 retired_at timestamptz,
 last_maintenance_at timestamptz,
 purged_starts bigint not null default 0,
 purged_micro_usd bigint not null default 0,
 check(retire_at<=created_at+interval '90 days 1 second')
);
insert into public.ghostwriter_lifecycle(singleton) values(true);
alter table public.ghostwriter_lifecycle enable row level security;
revoke all on public.ghostwriter_lifecycle from public,anon,authenticated,service_role;
create function public.ghostwriter_lifecycle_monotonic() returns trigger
language plpgsql set search_path=pg_catalog as $$ begin
 if tg_op='DELETE' then raise exception 'Lifecycle cannot be removed'; end if;
 if new.created_at<>old.created_at or new.retire_at>old.retire_at
 or (old.retired_at is not null and new.retired_at is distinct from old.retired_at)
 or new.purged_starts<old.purged_starts or new.purged_micro_usd<old.purged_micro_usd
 then raise exception 'Lifecycle cannot be reopened or accounting reduced'; end if;
 return new;
end $$;
create trigger ghostwriter_lifecycle_monotonic before update or delete on public.ghostwriter_lifecycle
 for each row execute function public.ghostwriter_lifecycle_monotonic();
create function public.ghostwriter_lifecycle_no_truncate() returns trigger
language plpgsql set search_path=pg_catalog as $$ begin raise exception 'Lifecycle cannot be truncated'; end $$;
create trigger ghostwriter_lifecycle_no_truncate before truncate on public.ghostwriter_lifecycle
 execute function public.ghostwriter_lifecycle_no_truncate();

create function public.ghostwriter_release_active() returns boolean
language sql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
 select exists(select 1 from public.ghostwriter_lifecycle where singleton and retired_at is null
 and retire_at>clock_timestamp() and last_maintenance_at>clock_timestamp()-interval '2 hours')
$$;
revoke all on function public.ghostwriter_release_active() from public,anon,authenticated,service_role;
alter function public.ghostwriter_free_control_valid() rename to ghostwriter_control_before_retention;
revoke all on function public.ghostwriter_control_before_retention() from public,anon,authenticated,service_role;
create function public.ghostwriter_free_control_valid() returns boolean
language sql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
 select public.ghostwriter_release_active() and public.ghostwriter_control_before_retention()
$$;
revoke all on function public.ghostwriter_free_control_valid() from public,anon,authenticated;
grant execute on function public.ghostwriter_free_control_valid() to service_role;

-- The legacy session-aware admission RPC also replays existing Free rows.
-- Amend its read boundary while preserving its signature and admission checks.
do $$ declare definition text; original text; begin
 original:=pg_get_functiondef('public.ghostwriter_ai_reserve(uuid,uuid,text,text,text,bigint,integer,integer,integer,integer,integer,integer,integer,bigint,bigint,bigint)'::regprocedure);
 definition:=replace(original,'v_now := clock_timestamp();',
 'v_now := clock_timestamp();
  if not public.ghostwriter_release_active() then
    return jsonb_build_object(''kind'',''denied'',''reason'',''service_paused'');
  end if;');
 definition:=replace(definition,'''result'', v_existing.result_json',
 '''result'', case when v_existing.settled_at<=clock_timestamp()-interval ''7 days'' then null else v_existing.result_json end');
 if definition=original or position('case when v_existing.settled_at' in definition)=0
 then raise exception 'Unexpected legacy reserve definition'; end if;
 execute definition;
end $$;

-- Existing/stale inserts and dispatch claims share this irreversible fence.
create function public.ghostwriter_retirement_insert_fence() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$ begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 if not public.ghostwriter_release_active() then raise exception 'Release retired or maintenance unavailable' using errcode='42501'; end if;
 return new;
end $$;
create trigger ghostwriter_retirement_operations before insert on public.ghostwriter_ai_operations
 for each row execute function public.ghostwriter_retirement_insert_fence();
create trigger ghostwriter_retirement_entitlements before insert on public.ghostwriter_beta_entitlements
 for each row execute function public.ghostwriter_retirement_insert_fence();

alter function public.ghostwriter_ai_mark_dispatched(uuid,uuid) rename to ghostwriter_claim_before_retention;
revoke all on function public.ghostwriter_claim_before_retention(uuid,uuid) from public,anon,authenticated,service_role;
create function public.ghostwriter_ai_mark_dispatched(p_operation_id uuid,p_account_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$ begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 if not public.ghostwriter_release_active() then return false; end if;
 return public.ghostwriter_claim_before_retention(p_operation_id,p_account_id);
end $$;
alter function public.ghostwriter_free_reserve_bounded(uuid,uuid,text,text,text,text,jsonb) rename to ghostwriter_reserve_before_retention;
revoke all on function public.ghostwriter_reserve_before_retention(uuid,uuid,text,text,text,text,jsonb) from public,anon,authenticated,service_role;
create function public.ghostwriter_free_reserve_bounded(p_account_id uuid,p_session_id uuid,p_idempotency_key text,p_request_fingerprint text,p_organization_id text,p_project_id text,p_limits jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
declare result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 if not public.ghostwriter_release_active() then return jsonb_build_object('kind','denied','reason','service_paused'); end if;
 result:=public.ghostwriter_reserve_before_retention(p_account_id,p_session_id,p_idempotency_key,p_request_fingerprint,p_organization_id,p_project_id,p_limits);
 -- Expired content cannot be replayed even if a scheduled cleanup is delayed.
 if result->>'kind'='replay' and exists(select 1 from public.ghostwriter_ai_operations
 where id=(result->>'operation_id')::uuid and settled_at<=clock_timestamp()-interval '7 days') then
 result:=jsonb_set(result,'{result}','null'::jsonb);
 end if;
 return result;
end $$;
alter function public.ghostwriter_free_entitle_bounded(uuid,uuid,integer) rename to ghostwriter_entitle_before_retention;
revoke all on function public.ghostwriter_entitle_before_retention(uuid,uuid,integer) from public,anon,authenticated,service_role;
create function public.ghostwriter_free_entitle_bounded(p_account_id uuid,p_session_id uuid,p_accounts integer)
returns text language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$ begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 if not public.ghostwriter_release_active() then return 'service_paused'; end if;
 return public.ghostwriter_entitle_before_retention(p_account_id,p_session_id,p_accounts);
end $$;

-- Settlement can still account for late usage; it cannot resurrect old text.
create function public.ghostwriter_retention_redaction() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$ begin
 if not exists(select 1 from public.ghostwriter_lifecycle where singleton and retired_at is null and retire_at>clock_timestamp())
 or new.settled_at<=clock_timestamp()-interval '7 days' then new.result_json:=null; end if;
 return new;
end $$;
create trigger ghostwriter_retention_redaction before insert or update on public.ghostwriter_ai_operations
 for each row execute function public.ghostwriter_retention_redaction();
create index ghostwriter_payload_expiry_idx on public.ghostwriter_ai_operations(settled_at,id) where result_json is not null;

create function public.ghostwriter_retention_maintenance() returns jsonb
language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
declare expired integer; purged integer:=0; starts bigint:=0; cost bigint:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 update public.ghostwriter_lifecycle set retired_at=coalesce(retired_at,clock_timestamp()) where retire_at<=clock_timestamp();
 with batch as (select id from public.ghostwriter_ai_operations where result_json is not null
 and (settled_at<=clock_timestamp()-interval '7 days' or exists(select 1 from public.ghostwriter_lifecycle where retired_at is not null))
 order by settled_at nulls first,id limit 100 for update)
 update public.ghostwriter_ai_operations o set result_json=null from batch b where o.id=b.id;
 get diagnostics expired=row_count;
 -- Never discard unresolved liability or a deletion fence needed by a job.
 if exists(select 1 from public.ghostwriter_lifecycle where retired_at is not null)
 and not exists(select 1 from public.ghostwriter_ai_operations where state in ('reserved','dispatched','uncertain'))
 and not exists(select 1 from public.ghostwriter_deletions where completed_at is null) then
 with batch as (select id from public.ghostwriter_ai_operations where profile='portfolio-free'
 and settled_at<clock_timestamp()-interval '90 days' order by settled_at,id limit 100),
 removed as (delete from public.ghostwriter_ai_operations o using batch b where o.id=b.id returning o.*)
 select count(*),count(*) filter(where dispatched_at is not null),coalesce(sum(actual_micro_usd),0) into purged,starts,cost from removed;
 update public.ghostwriter_lifecycle set purged_starts=purged_starts+starts,purged_micro_usd=purged_micro_usd+cost;
 delete from public.ghostwriter_beta_entitlements where account_id in(select e.account_id from public.ghostwriter_beta_entitlements e
 where free_claimed_at<clock_timestamp()-interval '90 days' and not exists(select 1 from public.ghostwriter_ai_operations o where o.account_id=e.account_id) limit 100);
 -- Auth accounts remain user-controlled; their live revocation/deletion fences
 -- are retained until Auth actually confirms that the identity no longer exists.
 delete from public.ghostwriter_revoked_sessions where session_id in(select r.session_id from public.ghostwriter_revoked_sessions r
 where revoked_at<clock_timestamp()-interval '90 days' and not exists(select 1 from auth.sessions s where s.id=r.session_id) limit 100);
 delete from public.ghostwriter_deletions where account_id in(select d.account_id from public.ghostwriter_deletions d
 where completed_at<clock_timestamp()-interval '90 days' and not exists(select 1 from auth.users u where u.id=d.account_id)
 and not exists(select 1 from public.ghostwriter_ai_operations o where o.account_id=d.account_id) limit 100);
 end if;
 -- Idle cleanup is scheduled; each statement bounds expired-row work.
 delete from public.ghostwriter_used_challenges where ctid in(select ctid from public.ghostwriter_used_challenges where expires_at<clock_timestamp() limit 100);
 delete from public.ghostwriter_abuse_counters where ctid in(select ctid from public.ghostwriter_abuse_counters where window_start+window_ms*interval '1 millisecond'<clock_timestamp() limit 100);
 delete from public.ghostwriter_abuse_penalties where ctid in(select ctid from public.ghostwriter_abuse_penalties where blocked_until<clock_timestamp() and updated_at<clock_timestamp()-interval '1 day' limit 100);
 if to_regclass('cron.job_run_details') is not null then
 execute 'delete from cron.job_run_details where runid in(select r.runid from cron.job_run_details r join cron.job j on j.jobid=r.jobid where j.jobname=''ghostwriter-retention'' and r.end_time<clock_timestamp()-interval ''7 days'' order by r.end_time limit 100)';
 end if;
 update public.ghostwriter_lifecycle set last_maintenance_at=clock_timestamp();
 return jsonb_build_object('expiredPayloads',expired,'purgedOperations',purged,'purgedStarts',starts);
end $$;
revoke all on function public.ghostwriter_retention_maintenance(),public.ghostwriter_lifecycle_monotonic(),public.ghostwriter_lifecycle_no_truncate(),public.ghostwriter_retirement_insert_fence(),public.ghostwriter_retention_redaction() from public,anon,authenticated,service_role;
revoke all on function public.ghostwriter_ai_mark_dispatched(uuid,uuid),public.ghostwriter_free_reserve_bounded(uuid,uuid,text,text,text,text,jsonb),public.ghostwriter_free_entitle_bounded(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.ghostwriter_ai_mark_dispatched(uuid,uuid),public.ghostwriter_free_reserve_bounded(uuid,uuid,text,text,text,text,jsonb),public.ghostwriter_free_entitle_bounded(uuid,uuid,integer) to service_role;
