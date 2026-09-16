-- This Free-only release does not publish user content. Revoke direct access
-- too: hiding /g links cannot disable a previously granted Supabase RPC.
revoke all on function public.ghostwriter_public_rewrite_lookup(text) from public,anon,authenticated,service_role;
