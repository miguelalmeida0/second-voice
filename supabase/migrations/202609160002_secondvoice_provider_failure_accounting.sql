-- Known provider rejections must keep the fleet-wide dispatch charge while
-- releasing the visitor's successful-rewrite allowance.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create or replace function ghostwriter_private.enforce_combined_ai_cap() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_check boolean := false;
  v_dispatch boolean := false;
  v_known_failure boolean := false;
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
    -- A provider dispatch authorization is immutable. Known HTTP rejections are
    -- the only transition allowed to clear dispatched_at: the immutable global
    -- stamp remains, so the provider attempt still consumes the shared 60/24h cap.
    if new.global_dispatch_authorized_at is distinct from old.global_dispatch_authorized_at then
      raise exception using errcode = 'GW409', message = 'AI dispatch accounting is immutable';
    end if;

    v_known_failure :=
      old.global_dispatch_authorized_at is not null
      and old.state = 'dispatched'
      and old.dispatched_at is not null
      and new.state = 'failed'
      and new.outcome = 'failed'
      and new.dispatched_at is null
      and new.settled_at is not null
      and coalesce(new.actual_micro_usd, 0) = 0
      and new.failure_code in ('provider_rate_limited','provider_rejected','provider_unavailable');

    if old.global_dispatch_authorized_at is not null and (
       (new.dispatched_at is distinct from old.dispatched_at and not v_known_failure)
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
      v_exclude := old.id;
    end if;
  end if;

  if not v_check then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1', 0));

  update public.ghostwriter_ai_control
  set combined_ai_revision = combined_ai_revision + 1
  where singleton
  returning least(60, combined_ai_limit_24h, portfolio_global_daily_limit) into v_limit;
  if not found or v_limit is null or v_limit < 1 then
    raise exception using errcode = 'GW503', message = 'Combined AI control unavailable';
  end if;

  v_now := clock_timestamp();
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

create or replace function public.ghostwriter_ai_settle_known_failure(
  p_operation_id uuid,
  p_account_id uuid,
  p_reason text
) returns boolean
language plpgsql security definer set search_path = pg_catalog set statement_timeout = '3s' as $$
begin
  if p_reason not in ('provider_rate_limited','provider_rejected','provider_unavailable') then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1', 0));

  update public.ghostwriter_ai_operations
  set
    state = 'failed',
    outcome = 'failed',
    dispatched_at = null,
    settled_at = clock_timestamp(),
    actual_micro_usd = 0,
    failure_code = p_reason,
    result_json = null,
    updated_at = clock_timestamp()
  where id = p_operation_id
    and account_id = p_account_id
    and state = 'dispatched'
    and global_dispatch_authorized_at is not null
    and dispatched_at is not null;

  return found;
end $$;

revoke all on function public.ghostwriter_ai_settle_known_failure(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.ghostwriter_ai_settle_known_failure(uuid,uuid,text)
  to service_role;

comment on function public.ghostwriter_ai_settle_known_failure(uuid,uuid,text) is
  'Settles explicit provider HTTP rejection without charging user rewrite allowance. Fleet dispatch stamp remains immutable and charged.';

notify pgrst, 'reload schema';
commit;
