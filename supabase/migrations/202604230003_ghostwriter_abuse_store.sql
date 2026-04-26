create table if not exists public.ghostwriter_abuse_counters (
  key_hash text primary key,
  window_ms integer not null,
  window_start timestamptz not null default now(),
  hit_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint ghostwriter_abuse_counters_key_hash_format check (key_hash ~ '^[a-f0-9]{64}$'),
  constraint ghostwriter_abuse_counters_window_ms_range check (window_ms between 1000 and 86400000),
  constraint ghostwriter_abuse_counters_hit_count_nonnegative check (hit_count >= 0)
);

create table if not exists public.ghostwriter_abuse_penalties (
  key_hash text primary key,
  score integer not null default 0,
  blocked_until timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint ghostwriter_abuse_penalties_key_hash_format check (key_hash ~ '^[a-f0-9]{64}$'),
  constraint ghostwriter_abuse_penalties_score_nonnegative check (score >= 0)
);

create table if not exists public.ghostwriter_used_challenges (
  challenge_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint ghostwriter_used_challenges_hash_format check (challenge_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists ghostwriter_abuse_counters_updated_at_idx
  on public.ghostwriter_abuse_counters (updated_at);

create index if not exists ghostwriter_abuse_penalties_blocked_until_idx
  on public.ghostwriter_abuse_penalties (blocked_until);

create index if not exists ghostwriter_used_challenges_expires_at_idx
  on public.ghostwriter_used_challenges (expires_at);

alter table public.ghostwriter_abuse_counters enable row level security;
alter table public.ghostwriter_abuse_penalties enable row level security;
alter table public.ghostwriter_used_challenges enable row level security;

revoke all on table public.ghostwriter_abuse_counters from public;
revoke all on table public.ghostwriter_abuse_counters from anon;
revoke all on table public.ghostwriter_abuse_counters from authenticated;

revoke all on table public.ghostwriter_abuse_penalties from public;
revoke all on table public.ghostwriter_abuse_penalties from anon;
revoke all on table public.ghostwriter_abuse_penalties from authenticated;

revoke all on table public.ghostwriter_used_challenges from public;
revoke all on table public.ghostwriter_used_challenges from anon;
revoke all on table public.ghostwriter_used_challenges from authenticated;

create or replace function public.ghostwriter_penalty_window_seconds(p_score integer)
returns integer
language sql
immutable
as $$
  select case
    when greatest(coalesce(p_score, 0), 0) >= 9 then 3600
    when greatest(coalesce(p_score, 0), 0) >= 6 then 900
    when greatest(coalesce(p_score, 0), 0) >= 3 then 300
    else 60
  end;
$$;

create or replace function public.ghostwriter_abuse_consume(
  p_rules jsonb default '[]'::jsonb,
  p_penalty_key_hashes text[] default array[]::text[],
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_penalty_until timestamptz;
  v_retry_after integer := 0;
  v_rule jsonb;
  v_key_hash text;
  v_limit integer;
  v_window_ms integer;
  v_hit_count integer;
  v_window_start timestamptz;
begin
  if jsonb_typeof(coalesce(p_rules, '[]'::jsonb)) <> 'array' then
    raise exception 'p_rules must be a jsonb array';
  end if;

  select max(blocked_until)
    into v_penalty_until
  from public.ghostwriter_abuse_penalties
  where key_hash = any(coalesce(p_penalty_key_hashes, array[]::text[]))
    and blocked_until > p_now;

  if v_penalty_until is not null then
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_penalty_until - p_now)))::integer)
    );
  end if;

  for v_rule in
    select value from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb))
  loop
    v_key_hash := coalesce(v_rule->>'keyHash', v_rule->>'key_hash', '');
    v_limit := coalesce((v_rule->>'limit')::integer, 0);
    v_window_ms := coalesce((v_rule->>'windowMs')::integer, coalesce((v_rule->>'window_ms')::integer, 0));

    if v_key_hash !~ '^[a-f0-9]{64}$' or v_limit < 1 or v_window_ms < 1000 then
      raise exception 'Invalid abuse protection rule payload';
    end if;

    with upsert as (
      insert into public.ghostwriter_abuse_counters as counters (
        key_hash,
        window_ms,
        window_start,
        hit_count,
        updated_at
      )
      values (v_key_hash, v_window_ms, p_now, 1, p_now)
      on conflict (key_hash) do update
        set window_ms = excluded.window_ms,
            window_start = case
              when counters.window_ms = excluded.window_ms
               and counters.window_start > p_now - ((excluded.window_ms::text || ' milliseconds')::interval)
                then counters.window_start
              else p_now
            end,
            hit_count = case
              when counters.window_ms = excluded.window_ms
               and counters.window_start > p_now - ((excluded.window_ms::text || ' milliseconds')::interval)
                then counters.hit_count + 1
              else 1
            end,
            updated_at = p_now
      returning hit_count, window_start
    )
    select hit_count, window_start
      into v_hit_count, v_window_start
    from upsert;

    if v_hit_count > v_limit then
      v_retry_after := greatest(
        v_retry_after,
        greatest(
          1,
          ceil(extract(epoch from (v_window_start + ((v_window_ms::text || ' milliseconds')::interval) - p_now)))::integer
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'allowed', v_retry_after = 0,
    'retry_after_seconds', v_retry_after
  );
end;
$$;

create or replace function public.ghostwriter_abuse_apply_penalty(
  p_key_hashes text[] default array[]::text[],
  p_severity integer default 1,
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key_hash text;
  v_retry_after integer := 0;
  v_increment integer := greatest(1, least(coalesce(p_severity, 1), 12));
  v_blocked_until timestamptz;
begin
  foreach v_key_hash in array coalesce(p_key_hashes, array[]::text[]) loop
    if v_key_hash is null or v_key_hash !~ '^[a-f0-9]{64}$' then
      continue;
    end if;

    insert into public.ghostwriter_abuse_penalties as penalties (
      key_hash,
      score,
      blocked_until,
      updated_at
    )
    values (
      v_key_hash,
      v_increment,
      p_now + make_interval(secs => public.ghostwriter_penalty_window_seconds(v_increment)),
      p_now
    )
    on conflict (key_hash) do update
      set score = least(
            12,
            case
              when penalties.updated_at < p_now - interval '1 hour' then v_increment
              else penalties.score + v_increment
            end
          ),
          blocked_until = greatest(
            penalties.blocked_until,
            p_now + make_interval(
              secs => public.ghostwriter_penalty_window_seconds(
                least(
                  12,
                  case
                    when penalties.updated_at < p_now - interval '1 hour' then v_increment
                    else penalties.score + v_increment
                  end
                )
              )
            )
          ),
          updated_at = p_now
    returning blocked_until into v_blocked_until;

    v_retry_after := greatest(
      v_retry_after,
      greatest(1, ceil(extract(epoch from (v_blocked_until - p_now)))::integer)
    );
  end loop;

  return v_retry_after;
end;
$$;

create or replace function public.ghostwriter_abuse_consume_challenge(
  p_challenge_hash text,
  p_expires_at timestamptz,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_challenge_hash is null or p_challenge_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid challenge hash';
  end if;

  if p_expires_at <= p_now then
    return false;
  end if;

  insert into public.ghostwriter_used_challenges (
    challenge_hash,
    expires_at,
    created_at
  )
  values (p_challenge_hash, p_expires_at, p_now)
  on conflict (challenge_hash) do nothing;

  return found;
end;
$$;

create or replace function public.ghostwriter_abuse_cleanup(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counters integer := 0;
  v_penalties integer := 0;
  v_challenges integer := 0;
begin
  delete from public.ghostwriter_abuse_counters
  where updated_at < p_now - interval '1 day';
  get diagnostics v_counters = row_count;

  delete from public.ghostwriter_abuse_penalties
  where blocked_until <= p_now
    and updated_at < p_now - interval '1 hour';
  get diagnostics v_penalties = row_count;

  delete from public.ghostwriter_used_challenges
  where expires_at <= p_now;
  get diagnostics v_challenges = row_count;

  return jsonb_build_object(
    'counters_deleted', v_counters,
    'penalties_deleted', v_penalties,
    'used_challenges_deleted', v_challenges
  );
end;
$$;

revoke all on function public.ghostwriter_penalty_window_seconds(integer) from public;
revoke all on function public.ghostwriter_penalty_window_seconds(integer) from anon;
revoke all on function public.ghostwriter_penalty_window_seconds(integer) from authenticated;
grant execute on function public.ghostwriter_penalty_window_seconds(integer) to service_role;

revoke all on function public.ghostwriter_abuse_consume(jsonb, text[], timestamptz) from public;
revoke all on function public.ghostwriter_abuse_consume(jsonb, text[], timestamptz) from anon;
revoke all on function public.ghostwriter_abuse_consume(jsonb, text[], timestamptz) from authenticated;
grant execute on function public.ghostwriter_abuse_consume(jsonb, text[], timestamptz) to service_role;

revoke all on function public.ghostwriter_abuse_apply_penalty(text[], integer, timestamptz) from public;
revoke all on function public.ghostwriter_abuse_apply_penalty(text[], integer, timestamptz) from anon;
revoke all on function public.ghostwriter_abuse_apply_penalty(text[], integer, timestamptz) from authenticated;
grant execute on function public.ghostwriter_abuse_apply_penalty(text[], integer, timestamptz) to service_role;

revoke all on function public.ghostwriter_abuse_consume_challenge(text, timestamptz, timestamptz) from public;
revoke all on function public.ghostwriter_abuse_consume_challenge(text, timestamptz, timestamptz) from anon;
revoke all on function public.ghostwriter_abuse_consume_challenge(text, timestamptz, timestamptz) from authenticated;
grant execute on function public.ghostwriter_abuse_consume_challenge(text, timestamptz, timestamptz) to service_role;

revoke all on function public.ghostwriter_abuse_cleanup(timestamptz) from public;
revoke all on function public.ghostwriter_abuse_cleanup(timestamptz) from anon;
revoke all on function public.ghostwriter_abuse_cleanup(timestamptz) from authenticated;
grant execute on function public.ghostwriter_abuse_cleanup(timestamptz) to service_role;
