-- Operator history and a non-replenishing one-operation canary.
alter table public.ghostwriter_ai_control add column deployment_id uuid not null default gen_random_uuid();
create table public.ghostwriter_operator_events (
 id bigint generated always as identity primary key,
 happened_at timestamptz not null default clock_timestamp(),
 actor text not null default session_user,
 subject_id uuid,
 action text not null check(length(action) between 1 and 80),
 reason text not null check(length(reason) between 1 and 240)
);
create table public.ghostwriter_canary (
 singleton boolean primary key default true check(singleton),
 run_id uuid not null unique,
 account_id uuid not null,
 operation_id uuid unique,
 ceiling_micro_usd bigint not null default 10000 check(ceiling_micro_usd between 1 and 10000)
);
alter table public.ghostwriter_operator_events enable row level security;
alter table public.ghostwriter_canary enable row level security;
revoke all on public.ghostwriter_operator_events,public.ghostwriter_canary from public,anon,authenticated,service_role;
-- Actual externally observed usage may exceed the reservation. Never clamp it.
alter table public.ghostwriter_ai_operations drop constraint ghostwriter_ai_operations_actual_cost_check;
alter table public.ghostwriter_ai_operations add constraint ghostwriter_ai_operations_actual_cost_check check(actual_micro_usd is null or actual_micro_usd>=0);
create function public.ghostwriter_canary_admit()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare c public.ghostwriter_canary%rowtype;
begin
 select * into c from public.ghostwriter_canary where singleton for update;
 if not found then return new; end if;
 if c.operation_id is not null or new.account_id<>c.account_id
 or new.idempotency_key<>'canary-'||c.run_id::text or new.reserved_micro_usd>c.ceiling_micro_usd then
  raise exception 'canary admission denied' using errcode='42501';
 end if;
 update public.ghostwriter_canary set operation_id=new.id where singleton;
 return new;
end $$;
revoke all on function public.ghostwriter_canary_admit() from public,anon,authenticated,service_role;
create trigger ghostwriter_canary_admit before insert on public.ghostwriter_ai_operations for each row execute function public.ghostwriter_canary_admit();
-- Do not release old uncertain operations through the legacy reconciliation RPC.
-- Operator tooling below uses expected state, records actual usage and stays paused.
revoke all on function public.ghostwriter_ai_reconcile_uncertain(uuid,bigint,text,text) from public,anon,authenticated,service_role;
create or replace function public.ghostwriter_ai_mark_uncertain(p_operation_id uuid,p_account_id uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s'
as $$ begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 update public.ghostwriter_ai_operations set state='uncertain',failure_code=left(coalesce(p_reason,'provider_status_uncertain'),120),updated_at=clock_timestamp()
 where id=p_operation_id and account_id=p_account_id and state in ('reserved','dispatched');
 if not found then return false; end if;
 perform public.ghostwriter_ai_pause('uncertain_operation');
 return true;
end $$;
