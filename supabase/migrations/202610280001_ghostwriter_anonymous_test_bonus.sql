-- Explicit operator top-ups for a single signed anonymous browser identity.
-- The public reference alone cannot authenticate that identity: the app still
-- requires its signed HttpOnly visitor cookie. No self-service issuance grants.
create table public.ghostwriter_anonymous_test_bonus (
  visitor_id uuid primary key,
  extra_rewrites smallint not null check (extra_rewrites between 1 and 5),
  granted_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  reason text not null check (length(reason) between 1 and 240),
  check (expires_at > granted_at and expires_at <= granted_at + interval '24 hours')
);
alter table public.ghostwriter_anonymous_test_bonus enable row level security;
revoke all on public.ghostwriter_anonymous_test_bonus from public, anon, authenticated, service_role;

create function public.ghostwriter_anonymous_bonus(p_visitor_id uuid) returns integer
language sql stable security definer set search_path=pg_catalog as $$
  select coalesce((select extra_rewrites::integer from public.ghostwriter_anonymous_test_bonus
    where visitor_id=p_visitor_id and granted_at<=statement_timestamp() and expires_at>statement_timestamp()),0);
$$;
revoke all on function public.ghostwriter_anonymous_bonus(uuid) from public, anon, authenticated, service_role;

-- Change only visitor-day comparisons. Preserve minute, concurrency, combined
-- global capacity, dispatch and budget gates and all operation history.
do $$
declare original text; updated text;
begin
  original := pg_get_functiondef('public.ghostwriter_anonymous_reserve_bounded(uuid,text,text,text,text,jsonb,integer)'::regprocedure);
  updated := replace(original, '>=visitor_day then ''anonymous_day_limit''',
    '>=visitor_day+public.ghostwriter_anonymous_bonus(p_visitor_id) then ''anonymous_day_limit''');
  if updated=original then raise exception 'Unknown anonymous reserve day guard'; end if;
  execute updated;

  original := pg_get_functiondef('public.ghostwriter_anonymous_allowance_before_combined_cap(uuid)'::regprocedure);
  updated := replace(original, 'greatest(0,visitor_day-used)',
    'greatest(0,visitor_day+public.ghostwriter_anonymous_bonus(p_visitor_id)-used)');
  if updated=original then
    updated := replace(original, 'greatest(0,3-used)',
      'greatest(0,3+public.ghostwriter_anonymous_bonus(p_visitor_id)-used)');
  end if;
  if updated=original then raise exception 'Unknown anonymous allowance calculation'; end if;
  execute updated;

  if has_function_privilege('anon','public.ghostwriter_anonymous_bonus(uuid)','execute')
    or has_function_privilege('authenticated','public.ghostwriter_anonymous_bonus(uuid)','execute')
    or has_table_privilege('service_role','public.ghostwriter_anonymous_test_bonus','insert') then
    raise exception 'Bonus privileges are too broad';
  end if;
  if public.ghostwriter_anonymous_bonus(null)<>0 then raise exception 'Unknown visitor received a bonus'; end if;
end $$;
