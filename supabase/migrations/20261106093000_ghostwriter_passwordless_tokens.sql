-- Activate as Authentication > Hooks > Custom Access Token after migration.
-- Second Voice supports OAuth and email OTP, never reusable passwords.
-- No user data is read, changed, logged or sent to an external service.
create or replace function public.ghostwriter_passwordless_tokens(event jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
declare
  claims jsonb := event->'claims';
  method text := event->>'authentication_method';
  evidence jsonb;
  has_passwordless boolean := false;
  denied constant jsonb := '{"error":{"http_code":403,"message":"Use GitHub or an email sign-in code. Password sign-in is not supported."}}'::jsonb;
begin
  if jsonb_typeof(claims) is distinct from 'object'
    or method is null
    or method not in ('oauth', 'otp', 'magiclink', 'token_refresh', 'totp') then
    return denied;
  end if;

  -- Never trust user_metadata or a caller-provided provider label. Auth's AMR
  -- records preserve the original login method across refresh and MFA.
  if claims ? 'amr' then
    if jsonb_typeof(claims->'amr') is distinct from 'array' then return denied; end if;
    for evidence in select value from jsonb_array_elements(claims->'amr') loop
      if jsonb_typeof(evidence) is distinct from 'object'
        or jsonb_typeof(evidence->'method') is distinct from 'string' then
        return denied;
      end if;
      if evidence->>'method' = 'password' then return denied; end if;
      if evidence->>'method' in ('oauth', 'otp', 'magiclink') then
        has_passwordless := true;
      end if;
    end loop;
  end if;

  if method in ('token_refresh', 'totp') and not has_passwordless then
    return denied;
  end if;
  -- Return the original claims unchanged, preserving subject, role, expiry,
  -- session identity and any other provider claims.
  return jsonb_build_object('claims', claims);
end;
$$;

revoke all on function public.ghostwriter_passwordless_tokens(jsonb)
  from public, anon, authenticated, service_role;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.ghostwriter_passwordless_tokens(jsonb)
  to supabase_auth_admin;

comment on function public.ghostwriter_passwordless_tokens(jsonb) is
  'Passwordless-only token issuance: OAuth/email OTP allowed; passwords and password-origin refresh rejected. Activate as Custom Access Token hook.';
