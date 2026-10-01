-- One fleet-wide rolling-24-hour admission/dispatch ceiling.
-- Does not enable AI, widen a budget, reset usage, change OAuth, or refund dispatches.
-- Database first: old Vercel deployments are protected by the same table trigger.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

select pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1', 0));

alter table public.ghostwriter_ai_control
  add column combined_ai_limit_24h integer not null default 60
    check (combined_ai_limit_24h between 1 and 60),
  add column combined_ai_revision bigint not null default 0
    check (combined_ai_revision >= 0);

-- Keep any owner-configured tighter database limit; never widen the existing cap.
update public.ghostwriter_ai_control
set combined_ai_limit_24h = least(60, portfolio_global_daily_limit)
where singleton;

alter table public.ghostwriter_ai_operations
  add column global_dispatch_authorized_at timestamptz;

-- Carry existing consumption into the new window. No reset on installation.
-- Pre-existing dispatched/uncertain rows without a trustworthy dispatch timestamp
-- are charged at installation time, conservatively, rather than silently ignored.
update public.ghostwriter_ai_operations
set global_dispatch_authorized_at = case
  when dispatched_at is not null then dispatched_at
  when state in ('dispatched', 'uncertain') or outcome = 'succeeded'
    then clock_timestamp()
  else null
end;

create index ghostwriter_global_dispatch_window_idx
  on public.ghostwriter_ai_operations (global_dispatch_authorized_at)
  where global_dispatch_authorized_at is not null;
create index ghostwriter_global_undispatched_holds_idx
  on public.ghostwriter_ai_operations (id)
  where global_dispatch_authorized_at is null
    and state in ('reserved', 'dispatched', 'uncertain');

create schema if not exists ghostwriter_private;
revoke all on schema ghostwriter_private from public, anon, authenticated, service_role;

-- Read-only snapshot for UI/health. This is NOT a dispatch authorization.
-- No principal/profile/IP/session filter: all identities consume the same pool.
create function ghostwriter_private.combined_ai_capacity(
  p_exclude_operation_id uuid default null,
  p_now timestamptz default clock_timestamp()
) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_limit integer;
  v_used bigint;
  v_expiring bigint;
  v_expiry timestamptz;
  v_retry integer := 60;
begin
  select least(60, combined_ai_limit_24h, portfolio_global_daily_limit)
  into v_limit from public.ghostwriter_ai_control where singleton;
  if v_limit is null or v_limit < 1 then
    return jsonb_build_object('configured', false, 'available', false);
  end if;

  select count(*), count(global_dispatch_authorized_at)
  into v_used, v_expiring
  from public.ghostwriter_ai_operations
  where id is distinct from p_exclude_operation_id
    and (
      global_dispatch_authorized_at > p_now - interval '24 hours'
      or (global_dispatch_authorized_at is null
          and state in ('reserved', 'dispatched', 'uncertain'))
    );

  if v_used >= v_limit then
    -- If the owner lowered the limit, enough old permits must expire, not just one.
    -- Unstamped unresolved holds have no expiry; provide a bounded retry hint only.
    if v_expiring > v_used - v_limit then
      select global_dispatch_authorized_at + interval '24 hours' into v_expiry
      from public.ghostwriter_ai_operations
      where id is distinct from p_exclude_operation_id
        and global_dispatch_authorized_at > p_now - interval '24 hours'
      order by global_dispatch_authorized_at, id
      offset (v_used - v_limit) limit 1;
      v_retry := greatest(1, least(86400,
        ceil(extract(epoch from v_expiry - p_now))::integer));
    end if;
  end if;

  return jsonb_build_object(
    'configured', true, 'available', v_used < v_limit,
    'limit', v_limit, 'used', v_used,
    'remaining', greatest(0, v_limit - v_used),
    'windowSeconds', 86400, 'retryAfterSeconds', v_retry
  );
end $$;
revoke all on function ghostwriter_private.combined_ai_capacity(uuid,timestamptz)
  from public, anon, authenticated, service_role;

-- Enforce below the RPC layer, so legacy/stale reserve and dispatch RPCs cannot
-- miss the check. Lock order matches existing reservation/dispatch transactions.
create function ghostwriter_private.enforce_combined_ai_cap() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_check boolean := false;
  v_dispatch boolean := false;
  v_exclude uuid := null;
  v_capacity jsonb;
  v_now timestamptz;
  v_limit integer;
begin
  if tg_op = 'INSERT' then
    if new.global_dispatch_authorized_at is not null
       or new.dispatched_at is not null or new.state <> 'reserved' then
      raise exception using errcode = 'GW409', message = 'Invalid initial AI operation state';
    end if;
    v_check := true;
  else
    -- Content redaction, settlement, failure and owner reconciliation preserve
    -- the immutable dispatch stamp. They cannot refund a provider attempt.
    if new.global_dispatch_authorized_at is distinct from old.global_dispatch_authorized_at then
      raise exception using errcode = 'GW409', message = 'AI dispatch accounting is immutable';
    end if;
    if old.global_dispatch_authorized_at is not null and (
       new.dispatched_at is distinct from old.dispatched_at
       or new.id is distinct from old.id
       or new.account_id is distinct from old.account_id
       or new.principal_kind is distinct from old.principal_kind
       or new.profile is distinct from old.profile
    ) then
      raise exception using errcode = 'GW409', message = 'AI dispatch identity is immutable';
    end if;
    if new.state = 'reserved' and old.state <> 'reserved' then
      raise exception using errcode = 'GW409', message = 'AI operations cannot be reopened';
    end if;
    if old.global_dispatch_authorized_at is null
       and (new.state = 'dispatched' or new.dispatched_at is not null) then
      if old.state <> 'reserved' or new.state <> 'dispatched'
         or new.dispatched_at is null then
        raise exception using errcode = 'GW409', message = 'Invalid AI dispatch transition';
      end if;
      v_check := true;
      v_dispatch := true;
      v_exclude := old.id; -- Its existing hold must not be charged twice.
    end if;
  end if;

  if not v_check then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1', 0));

  -- A real row write also fences REPEATABLE READ/SERIALIZABLE snapshots. At those
  -- isolation levels a stale concurrent admission must abort, not use old counts.
  update public.ghostwriter_ai_control
  set combined_ai_revision = combined_ai_revision + 1
  where singleton
  returning least(60, combined_ai_limit_24h, portfolio_global_daily_limit) into v_limit;
  if not found or v_limit is null or v_limit < 1 then
    raise exception using errcode = 'GW503', message = 'Combined AI control unavailable';
  end if;

  v_now := clock_timestamp(); -- Sample only after acquiring both locks.
  v_capacity := ghostwriter_private.combined_ai_capacity(v_exclude, v_now);
  if (v_capacity->>'configured')::boolean is distinct from true then
    raise exception using errcode = 'GW503', message = 'Combined AI control unavailable';
  end if;
  if (v_capacity->>'available')::boolean is distinct from true then
    raise exception using
      errcode = 'GW429', message = 'global_combined_limit',
      detail = jsonb_build_object('retryAfterSeconds',
        (v_capacity->>'retryAfterSeconds')::integer)::text;
  end if;

  if v_dispatch then new.global_dispatch_authorized_at := v_now; end if;
  return new;
end $$;
revoke all on function ghostwriter_private.enforce_combined_ai_cap()
  from public, anon, authenticated, service_role;
create trigger ghostwriter_00_combined_ai_cap
  before insert or update on public.ghostwriter_ai_operations
  for each row execute function ghostwriter_private.enforce_combined_ai_cap();

-- Runtime credentials never acquire direct writes to either authoritative table.
-- Application account deletion only redacts content; accounting remains in place.
revoke all on public.ghostwriter_ai_operations, public.ghostwriter_ai_control
  from public, anon, authenticated, service_role;

-- Preserve the existing Auth/visitor verification and 3-rewrite calculation.
-- Add only the shared-capacity signal; old clients still fail closed on available=false.
alter function public.ghostwriter_anonymous_allowance(uuid)
  rename to ghostwriter_anonymous_allowance_before_combined_cap;
revoke all on function public.ghostwriter_anonymous_allowance_before_combined_cap(uuid)
  from public, anon, authenticated, service_role;
create function public.ghostwriter_anonymous_allowance(p_visitor_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog set statement_timeout = '3s' as $$
declare v_result jsonb; v_capacity jsonb;
begin
  v_result := public.ghostwriter_anonymous_allowance_before_combined_cap(p_visitor_id);
  if v_result is null then return null; end if;
  v_capacity := ghostwriter_private.combined_ai_capacity();
  if (v_capacity->>'configured')::boolean is distinct from true then
    return v_result || jsonb_build_object('available', false);
  end if;
  if (v_capacity->>'available')::boolean is distinct from true then
    return v_result || jsonb_build_object('available', false, 'globalLimited', true,
      'retryAfterSeconds', (v_capacity->>'retryAfterSeconds')::integer);
  end if;
  return v_result || jsonb_build_object('globalLimited', false);
end $$;

alter function public.ghostwriter_portfolio_allowance(uuid,uuid,text)
  rename to ghostwriter_portfolio_allowance_before_combined_cap;
revoke all on function public.ghostwriter_portfolio_allowance_before_combined_cap(uuid,uuid,text)
  from public, anon, authenticated, service_role;
create function public.ghostwriter_portfolio_allowance(
  p_account_id uuid, p_session_id uuid, p_principal_kind text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog set statement_timeout = '3s' as $$
declare v_result jsonb; v_capacity jsonb;
begin
  v_result := public.ghostwriter_portfolio_allowance_before_combined_cap(
    p_account_id, p_session_id, p_principal_kind);
  if v_result is null then return null; end if;
  v_capacity := ghostwriter_private.combined_ai_capacity();
  if (v_capacity->>'configured')::boolean is distinct from true then
    return v_result || jsonb_build_object('available', false);
  end if;
  if (v_capacity->>'available')::boolean is distinct from true then
    return v_result || jsonb_build_object('available', false, 'globalLimited', true,
      'retryAfterSeconds', (v_capacity->>'retryAfterSeconds')::integer);
  end if;
  return v_result || jsonb_build_object('globalLimited', false);
end $$;

-- Refresh the legacy allowance alias as well; keep old client paths on the wrapper.
create or replace function public.ghostwriter_free_allowance(p_account_id uuid,p_session_id uuid)
returns jsonb language sql security definer set search_path = pg_catalog set statement_timeout = '3s' as $$
  select public.ghostwriter_portfolio_allowance(p_account_id,p_session_id,'authenticated');
$$;

create function public.ghostwriter_combined_ai_health() returns jsonb
language sql security definer set search_path = pg_catalog set statement_timeout = '3s' as $$
  select ghostwriter_private.combined_ai_capacity()
    || jsonb_build_object('version', 1, 'scope', 'all_principals_all_profiles');
$$;
revoke all on function public.ghostwriter_anonymous_allowance(uuid),
  public.ghostwriter_portfolio_allowance(uuid,uuid,text), public.ghostwriter_free_allowance(uuid,uuid),
  public.ghostwriter_combined_ai_health()
  from public, anon, authenticated, service_role;
grant execute on function public.ghostwriter_anonymous_allowance(uuid),
  public.ghostwriter_portfolio_allowance(uuid,uuid,text), public.ghostwriter_free_allowance(uuid,uuid),
  public.ghostwriter_combined_ai_health()
  to service_role;

comment on column public.ghostwriter_ai_operations.global_dispatch_authorized_at is
  'Immutable database-time provider-dispatch authorization. A failed or uncertain dispatch is not refunded.';
comment on column public.ghostwriter_ai_control.combined_ai_limit_24h is
  'Fleet-wide rolling-24-hour ceiling, all principals/profiles. Effective maximum 60; only the database owner can lower it.';

notify pgrst, 'reload schema';
commit;
