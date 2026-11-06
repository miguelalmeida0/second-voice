# Passwordless authentication policy

Second Voice signs users in through GitHub OAuth or email OTP. It has no
password registration, password login or password reset UI. On 6 November
2026, the production database had one user and zero stored password hashes.

`ghostwriter_passwordless_tokens` is a Custom Access Token hook, available
on Supabase Free. It prevents tokens from being issued for password login,
password signup, password-origin refresh, recovery and unsupported methods.
OAuth and email OTP remain available. Refresh/MFA must retain Auth-generated
evidence of an allowed original login. User-editable metadata is ignored.
Allowed claims are returned unchanged. The hook has no network calls, table
access, credentials, or SECURITY DEFINER privileges.

## Activation

1. Apply `20261106093000_ghostwriter_passwordless_tokens.sql`.
2. In Authentication > Hooks, inspect any existing Custom Access Token hook.
   Do not replace an unrelated hook without composing its policy first.
3. Select Postgres, schema `public`, function `ghostwriter_passwordless_tokens`.
4. Enable and save. A migration by itself does not activate the hook.
5. Verify GitHub/OTP login and refresh. Never test against a real user's
   password or introduce a password to the owner's account.

Tests in `tests/fixtures/passwordless-tokens.sql` exercise 25 admission and
rejection cases under `supabase_auth_admin`, plus ACL checks. Run after the
migration in a disposable PostgreSQL database with Supabase roles present.

## Boundaries

This is passwordless enforcement, not a breached-password lookup service.
Supabase's paid leaked-password toggle can remain off. Passwords created
through a direct API call might still be stored, but cannot issue a usable
token through password sign-in once this hook is active. No existing password
users were found before the change. Existing
issued access tokens are not retroactively revoked by a token hook.

Email and GitHub accounts still need their own MFA/passkeys. Passwordless
login does not prevent mailbox takeover, OAuth account takeover, session theft,
phishing, or application vulnerabilities. Adding another sign-in mechanism
requires reviewing and testing this allowlist first.

If a provider compatibility failure locks out valid sign-ins, disable this
specific hook in Authentication > Hooks to restore the previous behavior,
then investigate before re-enabling. Keep the migration for audit history.
