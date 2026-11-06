-- Run after the passwordless-token migration. No production users required.
begin;
set local role supabase_auth_admin;
do $$
declare
  scenario record;
  result jsonb;
  claims jsonb;
begin
  for scenario in select * from (values
    ('oauth', '[{"method":"oauth"}]'::jsonb, true),
    ('otp', '[{"method":"otp"}]'::jsonb, true),
    ('magiclink', '[{"method":"otp"}]'::jsonb, true),
    ('token_refresh', '[{"method":"oauth"}]'::jsonb, true),
    ('token_refresh', '[{"method":"otp"}]'::jsonb, true),
    ('totp', '[{"method":"oauth"},{"method":"totp"}]'::jsonb, true),
    ('password', '[{"method":"password"}]'::jsonb, false),
    ('password', '[{"method":"oauth"}]'::jsonb, false),
    ('email/signup', '[{"method":"password"}]'::jsonb, false),
    ('token_refresh', '[{"method":"password"}]'::jsonb, false),
    ('token_refresh', '[{"method":"password"},{"method":"totp"}]'::jsonb, false),
    ('token_refresh', '[{"method":"oauth"},{"method":"password"}]'::jsonb, false),
    ('token_refresh', '[]'::jsonb, false),
    ('totp', '[{"method":"totp"}]'::jsonb, false),
    ('oauth', '[{"method":"password"}]'::jsonb, false),
    ('otp', '{}'::jsonb, false),
    ('otp', '[null]'::jsonb, false),
    ('otp', '[{"method":null}]'::jsonb, false),
    ('recovery', '[{"method":"recovery"}]'::jsonb, false),
    ('anonymous', '[{"method":"anonymous"}]'::jsonb, false),
    ('future-method', '[{"method":"oauth"}]'::jsonb, false),
    (null, '[{"method":"oauth"}]'::jsonb, false)
  ) as cases(method, amr, allowed) loop
    claims := jsonb_build_object('sub', 'unchanged', 'role', 'authenticated',
      'amr', scenario.amr, 'user_metadata', '{"provider":"oauth"}'::jsonb);
    result := public.ghostwriter_passwordless_tokens(jsonb_build_object(
      'authentication_method', scenario.method, 'claims', claims));
    if scenario.allowed then
      if result is distinct from jsonb_build_object('claims', claims) then
        raise exception 'Allowed claims modified or rejected: %', scenario.method;
      end if;
    elsif result #>> '{error,http_code}' is distinct from '403' then
      raise exception 'Unsafe method accepted: % / %', scenario.method, scenario.amr;
    end if;
  end loop;
  if public.ghostwriter_passwordless_tokens(null) #>> '{error,http_code}' is distinct from '403'
    or public.ghostwriter_passwordless_tokens('{}') #>> '{error,http_code}' is distinct from '403'
    or public.ghostwriter_passwordless_tokens('{"authentication_method":"oauth","claims":null}') #>> '{error,http_code}' is distinct from '403' then
    raise exception 'Malformed event must fail closed';
  end if;
end;
$$;
reset role;
do $$
begin
  if has_function_privilege('anon', 'public.ghostwriter_passwordless_tokens(jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.ghostwriter_passwordless_tokens(jsonb)', 'EXECUTE')
    or has_function_privilege('service_role', 'public.ghostwriter_passwordless_tokens(jsonb)', 'EXECUTE') then
    raise exception 'Hook exposed to a public/API role';
  end if;
end;
$$;
rollback;
