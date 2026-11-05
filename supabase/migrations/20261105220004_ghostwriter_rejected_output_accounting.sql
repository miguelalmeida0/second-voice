-- Content rejection must not discard valid provider usage or stop the fleet.
-- This transition records a failed result while keeping the consumed dispatch,
-- user quota and exact observed charge. Unknown usage still stays uncertain.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create function public.ghostwriter_ai_settle_rejected_output(
  p_operation_id uuid,
  p_account_id uuid,
  p_actual_micro_usd bigint,
  p_provider_request_id text
) returns boolean
language plpgsql security definer set search_path = pg_catalog set statement_timeout = '3s' as $$
begin
  if p_actual_micro_usd is null or p_actual_micro_usd < 0
    or (p_provider_request_id is not null and length(p_provider_request_id) > 256) then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1', 0));
  update public.ghostwriter_ai_operations
  set state = 'settled', outcome = 'failed', actual_micro_usd = p_actual_micro_usd,
    provider_request_id = p_provider_request_id, failure_code = 'provider_output_rejected',
    result_json = null, settled_at = clock_timestamp(), updated_at = clock_timestamp()
  where id = p_operation_id and account_id = p_account_id and state = 'dispatched'
    and dispatched_at is not null and global_dispatch_authorized_at is not null
    and p_actual_micro_usd <= reserved_micro_usd;
  return found;
end $$;

revoke all on function public.ghostwriter_ai_settle_rejected_output(uuid,uuid,bigint,text)
  from public, anon, authenticated, service_role;
grant execute on function public.ghostwriter_ai_settle_rejected_output(uuid,uuid,bigint,text)
  to service_role;

comment on function public.ghostwriter_ai_settle_rejected_output(uuid,uuid,bigint,text) is
  'Records valid bounded usage for rejected model content. Does not refund dispatch, reset quota, retain content, or reconcile uncertain operations.';
notify pgrst, 'reload schema';
commit;
