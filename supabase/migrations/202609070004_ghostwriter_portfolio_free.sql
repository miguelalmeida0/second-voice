-- Forward-only portfolio profile. Never erases paid history or enables itself.
alter table public.ghostwriter_ai_operations add column profile text not null default 'paid' check(profile in ('paid','portfolio-free'));
alter table public.ghostwriter_beta_entitlements add column free_identity_hash text unique;
alter table public.ghostwriter_beta_entitlements add column free_claimed_at timestamptz;
alter table public.ghostwriter_beta_entitlements add column paid_approved boolean not null default true;
alter table public.ghostwriter_ai_control add column release_profile text not null default 'paid' check(release_profile in ('paid','portfolio-free'));
alter table public.ghostwriter_ai_control add column free_organization_id text;
alter table public.ghostwriter_ai_control add column free_project_id text;
alter table public.ghostwriter_ai_control add column free_verified_until timestamptz;
alter table public.ghostwriter_ai_control add column free_evidence_reference text;
alter table public.ghostwriter_canary add column active boolean not null default true;
create or replace function public.ghostwriter_canary_admit()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare c public.ghostwriter_canary%rowtype;
begin
 select * into c from public.ghostwriter_canary where singleton for update;
 if not found or not c.active then return new; end if;
 if c.operation_id is not null or new.account_id<>c.account_id or new.idempotency_key<>'canary-'||c.run_id::text or new.reserved_micro_usd>c.ceiling_micro_usd then raise exception 'canary admission denied' using errcode='42501'; end if;
 update public.ghostwriter_canary set operation_id=new.id where singleton;
 return new;
end $$;

create function public.ghostwriter_free_control_valid()
returns boolean language sql security definer set search_path=pg_catalog set statement_timeout='3s'
as $$ select exists(select 1 from public.ghostwriter_ai_control where singleton
 and release_profile='portfolio-free' and not paused and valid_until>clock_timestamp()
 and free_verified_until>clock_timestamp() and free_verified_until<=clock_timestamp()+interval '31 days'
 and length(free_organization_id) between 3 and 120 and length(free_project_id) between 3 and 120
 and length(free_evidence_reference) between 3 and 240) $$;

create function public.ghostwriter_free_entitle(p_account_id uuid,p_session_id uuid)
returns text language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s'
as $$ declare v_identity text; v_slot integer; v_existing public.ghostwriter_beta_entitlements%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 if not public.ghostwriter_ai_session_active(p_account_id,p_session_id) then return 'session_revoked'; end if;
 -- Sign-in may allocate a trial while temporarily paused, but only for an
 -- explicitly provisioned Free release. It can never approve the paid profile.
 if not exists(select 1 from public.ghostwriter_ai_control where singleton and release_profile='portfolio-free'
  and free_verified_until>clock_timestamp() and free_evidence_reference is not null) then return 'service_unavailable'; end if;
 select encode(sha256(convert_to(lower(btrim(email)),'UTF8')),'hex') into v_identity from auth.users where id=p_account_id and email_confirmed_at is not null;
 if v_identity is null then return 'unverified_identity'; end if;
 select * into v_existing from public.ghostwriter_beta_entitlements where account_id=p_account_id;
 if found then
  if v_existing.revoked_at is not null then return 'not_entitled'; end if;
  if v_existing.free_claimed_at is not null then return 'entitled'; end if;
 end if;
 if exists(select 1 from public.ghostwriter_beta_entitlements where free_identity_hash=v_identity) then return 'trial_already_claimed'; end if;
 if v_existing.account_id is not null then
  update public.ghostwriter_beta_entitlements set free_identity_hash=v_identity,free_claimed_at=clock_timestamp() where account_id=p_account_id;
 else
  select n into v_slot from generate_series(1,25)n where not exists(select 1 from public.ghostwriter_beta_entitlements where approved_slot=n) order by n limit 1;
  if v_slot is null then return 'trial_capacity'; end if;
  insert into public.ghostwriter_beta_entitlements(account_id,approved_slot,free_identity_hash,free_claimed_at,note,paid_approved)
   values(p_account_id,v_slot,v_identity,clock_timestamp(),'portfolio-free finite trial',false);
 end if;
 return 'entitled';
end $$;

create function public.ghostwriter_free_reserve(p_account_id uuid,p_session_id uuid,p_idempotency_key text,p_request_fingerprint text,p_organization_id text,p_project_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s'
as $$ declare t timestamptz; existing public.ghostwriter_ai_operations%rowtype; operation uuid; reason text;
begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 t:=clock_timestamp();
 if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,80}$' or p_request_fingerprint is null or p_request_fingerprint !~ '^[a-f0-9]{64}$' then return jsonb_build_object('kind','denied','reason','invalid_request'); end if;
 if not public.ghostwriter_ai_session_active(p_account_id,p_session_id) then return jsonb_build_object('kind','denied','reason','session_revoked'); end if;
 if not exists(select 1 from public.ghostwriter_beta_entitlements where account_id=p_account_id and free_claimed_at is not null and revoked_at is null and (expires_at is null or expires_at>t)) then return jsonb_build_object('kind','denied','reason','not_entitled'); end if;
 select * into existing from public.ghostwriter_ai_operations where account_id=p_account_id and idempotency_key=p_idempotency_key;
 if found then
  if existing.profile<>'portfolio-free' or existing.request_fingerprint<>p_request_fingerprint then return jsonb_build_object('kind','conflict','operation_id',existing.id); end if;
  -- Authenticated replay is safe even while paused: no new dispatch permission.
  return jsonb_build_object('kind','replay','operation_id',existing.id,'state',existing.state,'outcome',existing.outcome,'result',existing.result_json);
 end if;
 if not public.ghostwriter_free_control_valid() or not exists(select 1 from public.ghostwriter_ai_control where free_organization_id=p_organization_id and free_project_id=p_project_id) then return jsonb_build_object('kind','denied','reason','service_paused'); end if;
 if exists(select 1 from public.ghostwriter_ai_operations where state='uncertain') then return jsonb_build_object('kind','denied','reason','unresolved_liability'); end if;
 -- Pending reservations temporarily occupy capacity. Once a claim commits,
 -- dispatched_at is permanent; errors, logout and recovery cannot reset starts.
 select case
  when count(*) filter(where account_id=p_account_id and (dispatched_at is not null or state='reserved'))>=10 then 'account_lifetime_limit'
  when count(*) filter(where account_id=p_account_id and (dispatched_at>=t-interval '24 hours' or state='reserved'))>=3 then 'account_day_limit'
  when count(*) filter(where account_id=p_account_id and (dispatched_at>=t-interval '1 minute' or state='reserved'))>=1 then 'account_minute_limit'
  when count(*) filter(where dispatched_at is not null or state='reserved')>=250 then 'global_lifetime_limit'
  when count(*) filter(where dispatched_at>=t-interval '24 hours' or state='reserved')>=25 then 'global_day_limit'
  when count(*) filter(where dispatched_at>=t-interval '1 minute' or state='reserved')>=2 then 'global_minute_limit'
 end into reason from public.ghostwriter_ai_operations where profile='portfolio-free';
 if reason is not null then return jsonb_build_object('kind','denied','reason',reason); end if;
 if exists(select 1 from public.ghostwriter_ai_operations where state in ('reserved','dispatched','uncertain')) then return jsonb_build_object('kind','denied','reason','global_concurrency_limit'); end if;
 insert into public.ghostwriter_ai_operations(account_id,session_id,idempotency_key,request_fingerprint,pricing_version,reserved_micro_usd,profile)
 values(p_account_id,p_session_id,p_idempotency_key,p_request_fingerprint,'groq-openai-gpt-oss-20b-2026-09-07',750,'portfolio-free') returning id into operation;
 return jsonb_build_object('kind','admitted','operation_id',operation);
end $$;

-- Fence both profiles at claim. A legacy paid application cannot dispatch in a
-- Free deployment; a stale Free process cannot dispatch after a profile change.
alter function public.ghostwriter_ai_mark_dispatched(uuid,uuid) rename to ghostwriter_ai_claim_v2;
revoke all on function public.ghostwriter_ai_claim_v2(uuid,uuid) from public,anon,authenticated,service_role;
create function public.ghostwriter_ai_mark_dispatched(p_operation_id uuid,p_account_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s'
as $$ declare v_profile text; begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 select profile into v_profile from public.ghostwriter_ai_operations where id=p_operation_id and account_id=p_account_id;
 if not exists(select 1 from public.ghostwriter_ai_control where release_profile=v_profile) then return false; end if;
 if v_profile='portfolio-free' and not public.ghostwriter_free_control_valid() then return false; end if;
 return public.ghostwriter_ai_claim_v2(p_operation_id,p_account_id);
end $$;

create function public.ghostwriter_free_allowance(p_account_id uuid,p_session_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s'
as $$ begin
 if not public.ghostwriter_ai_session_active(p_account_id,p_session_id) then return null; end if;
 if not exists(select 1 from public.ghostwriter_beta_entitlements where account_id=p_account_id and free_claimed_at is not null and revoked_at is null) then return jsonb_build_object('remaining',0,'available',false); end if;
 return (select jsonb_build_object('remaining',greatest(0,10-count(*) filter(where dispatched_at is not null or state='reserved')),
 'todayRemaining',greatest(0,3-count(*) filter(where dispatched_at>=clock_timestamp()-interval '24 hours' or state='reserved')),
 'available',public.ghostwriter_free_control_valid()) from public.ghostwriter_ai_operations where account_id=p_account_id and profile='portfolio-free');
end $$;
revoke all on function public.ghostwriter_free_control_valid() from public,anon,authenticated,service_role;
revoke all on function public.ghostwriter_free_entitle(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ghostwriter_free_reserve(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.ghostwriter_free_allowance(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ghostwriter_ai_mark_dispatched(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ghostwriter_free_entitle(uuid,uuid),public.ghostwriter_free_reserve(uuid,uuid,text,text,text,text),public.ghostwriter_free_allowance(uuid,uuid),public.ghostwriter_ai_mark_dispatched(uuid,uuid) to service_role;

create function public.ghostwriter_profile_admit() returns trigger language plpgsql security definer set search_path=pg_catalog as $$ begin
 if not exists(select 1 from public.ghostwriter_ai_control where singleton and release_profile=new.profile) then raise exception 'release profile mismatch'; end if;
 if new.profile='paid' and not exists(select 1 from public.ghostwriter_beta_entitlements where account_id=new.account_id and paid_approved) then raise exception 'paid approval required'; end if;
 return new;
end $$;
revoke all on function public.ghostwriter_profile_admit() from public,anon,authenticated,service_role;
create trigger ghostwriter_profile_admit before insert on public.ghostwriter_ai_operations for each row execute function public.ghostwriter_profile_admit();
