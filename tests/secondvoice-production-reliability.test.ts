import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("ordinary rewrite throttling no longer self-escalates into cross-endpoint penalties", () => {
  const source = read("src/server/abuse-protection.ts");
  const limiter = source.slice(source.indexOf("async function enforceRateLimits"), source.indexOf("export async function validateBrowserGuard"));
  assert.match(source, /penalty-v2-ip/);
  assert.match(source, /rewrite-session-burst[^\n]*limit: 6/);
  assert.match(source, /rewrite-ip-burst[^\n]*limit: 12/);
  assert.match(limiter, /code: "ABUSE_COOLDOWN"/);
  assert.doesNotMatch(limiter, /return reject\(/);
  assert.doesNotMatch(source, /Too many requests\. Cooldown in progress\./);
});

test("challenge and rewrite APIs preserve structured reason and retry metadata", () => {
  const challenge = read("src/app/api/ghostwriter/challenge/route.ts");
  const rewrite = read("src/app/api/ghostwriter/route.ts");
  const client = read("src/lib/ghostwriter-client-guard.ts");
  assert.match(challenge, /reasonCode: challenge\.code \?\? null/);
  assert.match(rewrite, /reasonCode: result\.reasonCode \?\? null/);
  assert.match(rewrite, /"Retry-After"/);
  assert.match(client, /retryAfterSeconds/);
  assert.match(client, /challengeResponse\.headers\.get\("Retry-After"\)/);
});

test("known provider HTTP failures release visitor allowance without refunding fleet dispatch", () => {
  const provider = read("src/server/ai-provider.ts");
  const gateway = read("src/server/ai-gateway.ts");
  const migration = read("supabase/migrations/202609160002_secondvoice_provider_failure_accounting.sql");
  assert.match(provider, /provider_rate_limited/);
  assert.match(provider, /provider_unavailable/);
  assert.match(provider, /response\.status === 429/);
  assert.match(gateway, /settleKnownFailure\(operationId, accountId, reason\)/);
  assert.match(gateway, /"PROVIDER_BUSY"/);
  assert.match(migration, /new\.global_dispatch_authorized_at is distinct from old\.global_dispatch_authorized_at/);
  assert.match(migration, /new\.dispatched_at is null/);
  assert.match(migration, /failure_code = p_reason/);
  assert.doesNotMatch(migration, /failure_reason/);
  assert.match(migration, /grant execute on function public\.ghostwriter_ai_settle_known_failure\(uuid,uuid,text\)[\s\S]*to service_role/);
});

test("failure UI has no stale copy action and hides request ids behind technical details", () => {
  const playback = read("src/components/ghostwriter/RewritePlayback.tsx");
  const page = read("src/components/ghostwriter/GhostwriterPage.tsx");
  assert.match(playback, /!error && visiblePhase === "complete" && canCopy/);
  assert.match(playback, /<summary>Technical details<\/summary>/);
  assert.match(page, /rewriteInFlightRef\.current/);
  assert.match(page, /Your free-rewrite allowance is unchanged/);
  assert.doesNotMatch(page, /Next rewrite in [^\n]*free rewrites left today/);
});

test("serverless trace policy explicitly excludes local secret files", () => {
  const nextConfig = read("next.config.ts");
  const vercelIgnore = read(".vercelignore");
  assert.match(nextConfig, /outputFileTracingExcludes/);
  assert.match(nextConfig, /"\/\*"/);
  assert.match(nextConfig, /\.env\*/);
  assert.match(vercelIgnore, /^\.env\*/m);
});
