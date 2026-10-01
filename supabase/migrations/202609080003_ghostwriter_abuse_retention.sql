-- Bound attacker-created abuse state even if scheduled maintenance is absent.
-- Existing rows are not removed by migration. At capacity new identities fail
-- closed; active counters are never evicted to admit an attacker.
create function public.ghostwriter_abuse_storage_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog set statement_timeout='3s' as $$
declare n bigint; existing boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('ghostwriter-abuse-storage-v1',0));
 if tg_table_name='ghostwriter_abuse_counters' then
  delete from public.ghostwriter_abuse_counters where key_hash in (select key_hash from public.ghostwriter_abuse_counters where updated_at<clock_timestamp()-interval '1 day' limit 100);
  select exists(select 1 from public.ghostwriter_abuse_counters where key_hash=new.key_hash),count(*) into existing,n from public.ghostwriter_abuse_counters;
 elsif tg_table_name='ghostwriter_abuse_penalties' then
  delete from public.ghostwriter_abuse_penalties where key_hash in (select key_hash from public.ghostwriter_abuse_penalties where blocked_until<clock_timestamp() and updated_at<clock_timestamp()-interval '1 hour' limit 100);
  select exists(select 1 from public.ghostwriter_abuse_penalties where key_hash=new.key_hash),count(*) into existing,n from public.ghostwriter_abuse_penalties;
 elsif tg_table_name='ghostwriter_used_challenges' then
  delete from public.ghostwriter_used_challenges where challenge_hash in (select challenge_hash from public.ghostwriter_used_challenges where expires_at<clock_timestamp() limit 100);
  select exists(select 1 from public.ghostwriter_used_challenges where challenge_hash=new.challenge_hash),count(*) into existing,n from public.ghostwriter_used_challenges;
 else raise exception 'unexpected abuse table'; end if;
 if not existing and n>=5000 then raise exception 'abuse state capacity' using errcode='54000'; end if;
 return new;
end $$;
create trigger ghostwriter_abuse_storage_guard before insert on public.ghostwriter_abuse_counters for each row execute function public.ghostwriter_abuse_storage_guard();
create trigger ghostwriter_abuse_storage_guard before insert on public.ghostwriter_abuse_penalties for each row execute function public.ghostwriter_abuse_storage_guard();
create trigger ghostwriter_abuse_storage_guard before insert on public.ghostwriter_used_challenges for each row execute function public.ghostwriter_abuse_storage_guard();
revoke all on function public.ghostwriter_abuse_storage_guard() from public,anon,authenticated,service_role;
alter function public.ghostwriter_abuse_consume(jsonb,text[],timestamptz) set statement_timeout='3s';
alter function public.ghostwriter_abuse_apply_penalty(text[],integer,timestamptz) set statement_timeout='3s';
alter function public.ghostwriter_abuse_consume_challenge(text,timestamptz,timestamptz) set statement_timeout='3s';
