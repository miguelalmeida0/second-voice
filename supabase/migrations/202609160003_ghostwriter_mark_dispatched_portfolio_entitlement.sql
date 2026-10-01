-- ghostwriter_ai_mark_dispatched's non-anonymous branch checked the legacy
-- paid-beta entitlement table (ghostwriter_beta_entitlements) regardless of
-- profile. reserve() is already profile-aware and admits authenticated
-- portfolio-free users through ghostwriter_portfolio_entitlements instead, so
-- their reservation always matched but the dispatch stamp never did: every
-- signed-in portfolio-free rewrite failed at dispatch with "AI budget
-- controls are temporarily unavailable", 503, with the reservation charged.
-- Authenticated legacy/paid dispatch keeps its original entitlement check.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create or replace function public.ghostwriter_ai_mark_dispatched(p_operation_id uuid,p_account_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s'
as $$
declare v_kind text; v_profile text;
begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 select principal_kind,profile into v_kind,v_profile
 from public.ghostwriter_ai_operations where id=p_operation_id and account_id=p_account_id;

 if v_kind='anonymous' then
  if not public.ghostwriter_free_control_valid() or exists(select 1 from public.ghostwriter_ai_operations where state='uncertain') then return false; end if;
  update public.ghostwriter_ai_operations set state='dispatched',dispatched_at=clock_timestamp(),updated_at=clock_timestamp()
  where id=p_operation_id and account_id=p_account_id and principal_kind='anonymous' and profile='portfolio-free'
    and session_id is null and state='reserved' and created_at>clock_timestamp()-interval '30 seconds';
  return found;
 end if;

 if v_profile='portfolio-free' then
  if not public.ghostwriter_free_control_valid() or exists(select 1 from public.ghostwriter_ai_operations where state='uncertain') then return false; end if;
  update public.ghostwriter_ai_operations o set state='dispatched',dispatched_at=clock_timestamp(),updated_at=clock_timestamp()
  where o.id=p_operation_id and o.account_id=p_account_id and o.state='reserved'
    and o.created_at>clock_timestamp()-interval '30 seconds'
    and public.ghostwriter_ai_session_active(o.account_id,o.session_id)
    and exists(select 1 from public.ghostwriter_portfolio_entitlements e where e.account_id=o.account_id and e.revoked_at is null);
  return found;
 end if;

 return public.ghostwriter_mark_dispatched_before_anonymous(p_operation_id,p_account_id);
end $$;

notify pgrst, 'reload schema';
commit;
