-- Forward-only deletion fence. Never resets usage, trial slots or pause state.
create table public.ghostwriter_deletions (
 account_id uuid primary key,
 receipt_hash text not null unique check(receipt_hash ~ '^[a-f0-9]{64}$'),
 requested_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz,
 receipt_expires_at timestamptz not null default clock_timestamp()+interval '7 days'
);
alter table public.ghostwriter_deletions enable row level security;
revoke all on public.ghostwriter_deletions from public,anon,authenticated,service_role;

alter function public.ghostwriter_ai_session_active(uuid,uuid) rename to ghostwriter_session_active_before_deletion;
revoke all on function public.ghostwriter_session_active_before_deletion(uuid,uuid) from public,anon,authenticated,service_role;
create function public.ghostwriter_ai_session_active(p_account_id uuid,p_session_id uuid)
returns boolean language sql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
 select not exists(select 1 from public.ghostwriter_deletions where account_id=p_account_id)
 and public.ghostwriter_session_active_before_deletion(p_account_id,p_session_id)
$$;
revoke all on function public.ghostwriter_ai_session_active(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ghostwriter_ai_session_active(uuid,uuid) to service_role;

create function public.ghostwriter_delete_begin(p_account_id uuid,p_session_id uuid,p_receipt_hash text)
returns boolean language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 if p_receipt_hash is null or p_receipt_hash !~ '^[a-f0-9]{64}$'
 or not public.ghostwriter_ai_session_active(p_account_id,p_session_id)
 or not exists(select 1 from auth.sessions where id=p_session_id and user_id=p_account_id
   and created_at > clock_timestamp()-interval '10 minutes') then return false; end if;
 insert into public.ghostwriter_deletions(account_id,receipt_hash) values(p_account_id,p_receipt_hash);
 update public.ghostwriter_beta_entitlements set revoked_at=clock_timestamp() where account_id=p_account_id;
 update public.ghostwriter_ai_operations set result_json=null where account_id=p_account_id;
 -- A reserved request has no dispatch claim. Dispatched/uncertain work retains
 -- its liability and permanent start, even when its browser has disappeared.
 update public.ghostwriter_ai_operations set state='failed',outcome='failed',actual_micro_usd=0,
  failure_code='account_deleted_before_dispatch',settled_at=clock_timestamp()
 where account_id=p_account_id and state='reserved';
 return true;
end $$;

create function public.ghostwriter_delete_job(p_receipt_hash text)
returns jsonb language sql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
 select jsonb_build_object('accountId',account_id,'completed',completed_at is not null)
 from public.ghostwriter_deletions where receipt_hash=p_receipt_hash and receipt_expires_at>clock_timestamp()
$$;

create function public.ghostwriter_delete_objects(p_account_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
declare objects jsonb;
begin
 if not exists(select 1 from public.ghostwriter_deletions where account_id=p_account_id) then return null; end if;
 -- Isolated Auth-only fixtures have no Storage service. In hosted Supabase,
 -- remove objects through Storage API, never by deleting its metadata rows.
 if to_regclass('storage.objects') is null then return '[]'::jsonb; end if;
 execute 'select coalesce(jsonb_agg(jsonb_build_object(''bucket'',bucket_id,''name'',name)),''[]''::jsonb)
 from (select bucket_id,name from storage.objects o
 where coalesce(to_jsonb(o)->>''owner_id'',to_jsonb(o)->>''owner'')=$1 limit 100) owned'
 into objects using p_account_id::text;
 return objects;
end $$;

create function public.ghostwriter_delete_complete(p_account_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 if exists(select 1 from auth.users where id=p_account_id)
 or public.ghostwriter_delete_objects(p_account_id) is distinct from '[]'::jsonb then return false; end if;
 update public.ghostwriter_deletions set completed_at=coalesce(completed_at,clock_timestamp()) where account_id=p_account_id;
 return found;
end $$;

-- Every current and stale settlement writer is fenced, not just the new route.
create function public.ghostwriter_redact_deleted_result() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0));
 if exists(select 1 from public.ghostwriter_deletions where account_id=new.account_id) then new.result_json:=null; end if;
 return new;
end $$;
create trigger ghostwriter_redact_deleted_result before insert or update on public.ghostwriter_ai_operations
 for each row execute function public.ghostwriter_redact_deleted_result();
revoke all on function public.ghostwriter_redact_deleted_result() from public,anon,authenticated,service_role;
revoke all on function public.ghostwriter_delete_begin(uuid,uuid,text),public.ghostwriter_delete_job(text),public.ghostwriter_delete_objects(uuid),public.ghostwriter_delete_complete(uuid) from public,anon,authenticated;
grant execute on function public.ghostwriter_delete_begin(uuid,uuid,text),public.ghostwriter_delete_job(text),public.ghostwriter_delete_objects(uuid),public.ghostwriter_delete_complete(uuid) to service_role;
