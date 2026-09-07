import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  hasStrongSecuritySecret,
  normalizeSiteOrigin,
  normalizeIpAddress,
  normalizeTrustedClientIpHeader,
  publicSharingEnabled,
  resolveAbuseStoreConfig,
  resolveSecuritySecret,
  shouldTrustProxy,
} from "../src/lib/security-env.ts";

const SECURITY_CHECK_SCRIPT = fileURLToPath(new URL("../scripts/security-check.mjs", import.meta.url));
const README_PATH = new URL("../README.md", import.meta.url);
const TEST_SIGNING_VALUE = "ghostwriter-fixture-".repeat(2);
const GITHUB_SECURITY_WORKFLOW_PATH = new URL(
  "../.github/workflows/security.yml",
  import.meta.url,
);

const SECURITY_CHECK_ENV_KEYS = [
  "AI_ENABLED",
  "GEMINI_API_KEY",
  "GHOSTWRITER_ABUSE_STORE_MODE",
  "GHOSTWRITER_ALLOW_PUBLIC_SHARING",
  "GHOSTWRITER_PROVIDER",
  "GHOSTWRITER_SECURITY_SECRET",
  "GHOSTWRITER_CLIENT_IP_HEADER",
  "GHOSTWRITER_E2E_FIXTURE_MODE",
  "GHOSTWRITER_TRUST_PROXY",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "GHOSTWRITER_AI_PRICING_VERSION",
  "GHOSTWRITER_BETA_MAX_APPROVED_ACCOUNTS",
  "GHOSTWRITER_AI_LIFETIME_GENERATIONS_PER_ACCOUNT",
  "GHOSTWRITER_AI_ACCOUNT_GENERATIONS_PER_24H",
  "GHOSTWRITER_AI_ACCOUNT_GENERATIONS_PER_MINUTE",
  "GHOSTWRITER_AI_ACCOUNT_CONCURRENCY",
  "GHOSTWRITER_AI_GLOBAL_GENERATIONS_PER_MINUTE",
  "GHOSTWRITER_AI_GLOBAL_CONCURRENCY",
  "GHOSTWRITER_AI_MAX_INPUT_TOKENS",
  "GHOSTWRITER_AI_MAX_OUTPUT_TOKENS",
  "GHOSTWRITER_AI_MAX_OPERATION_MICRO_USD",
  "GHOSTWRITER_AI_HOURLY_BUDGET_MICRO_USD",
  "GHOSTWRITER_AI_24H_BUDGET_MICRO_USD",
  "GHOSTWRITER_AI_BETA_LIFETIME_BUDGET_MICRO_USD",
  "GHOSTWRITER_AI_REQUEST_BODY_BYTES",
  "GHOSTWRITER_AI_REQUEST_TIMEOUT_MS",
  "NEXT_PUBLIC_SITE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
];

function securityCheckEnv(overrides: Record<string, string>): NodeJS.ProcessEnv {
  const env = { ...process.env };

  for (const key of SECURITY_CHECK_ENV_KEYS) {
    delete env[key];
  }

  return {
    ...env,
    ...overrides,
  };
}

function workspaceTempDir(prefix: string): string {
  const tmpRoot = join(process.cwd(), ".tmp");

  mkdirSync(tmpRoot, { recursive: true });
  return mkdtempSync(join(tmpRoot, prefix));
}

test("rejects placeholder secrets", () => {
  assert.equal(hasStrongSecuritySecret("change_me_to_a_long_random_secret"), false);
  assert.equal(hasStrongSecuritySecret("short"), false);
  assert.equal(
    hasStrongSecuritySecret("9d2ec6b99627439e8c2605c4b8d9535ec19a"),
    true,
  );
});

test("requires configured secrets in production", () => {
  const resolved = resolveSecuritySecret({
    configuredSecret: "",
    ephemeralSecret: "dev-secret-that-would-be-fine-locally-only",
    nodeEnv: "production",
  });

  assert.equal(resolved.mode, "missing");
  assert.equal(resolved.secret, null);
});

test("allows ephemeral secrets in development", () => {
  const resolved = resolveSecuritySecret({
    configuredSecret: "",
    ephemeralSecret: "ephemeral-development-secret-which-is-long-enough",
    nodeEnv: "development",
  });

  assert.equal(resolved.mode, "ephemeral");
  assert.equal(resolved.secret, "ephemeral-development-secret-which-is-long-enough");
});

test("rejects in-memory abuse protection in production", () => {
  const resolved = resolveAbuseStoreConfig({
    mode: "memory",
    nodeEnv: "production",
    supabaseServiceRoleKey: "service-role",
    supabaseUrl: "https://supabase.example",
  });

  assert.equal(resolved.mode, null);
  assert.match(resolved.reason ?? "", /not sufficient for production/i);
});

test("requires supabase credentials for the durable abuse store", () => {
  const resolved = resolveAbuseStoreConfig({
    mode: "supabase",
    nodeEnv: "production",
    supabaseServiceRoleKey: "",
    supabaseUrl: "https://supabase.example",
  });

  assert.equal(resolved.mode, null);
  assert.match(resolved.reason ?? "", /requires both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/i);
});

test("does not trust proxy headers by default", () => {
  assert.equal(shouldTrustProxy(undefined), false);
  assert.equal(shouldTrustProxy("false"), false);
  assert.equal(shouldTrustProxy("true"), true);
});

test("normalizes only explicitly supported trusted client IP headers", () => {
  assert.equal(normalizeTrustedClientIpHeader("X-Forwarded-For"), "x-forwarded-for");
  assert.equal(normalizeTrustedClientIpHeader("cf-connecting-ip"), "cf-connecting-ip");
  assert.equal(normalizeTrustedClientIpHeader("x-client-ip"), null);
  assert.equal(normalizeTrustedClientIpHeader(""), null);
});

test("normalizes only valid IP addresses", () => {
  assert.equal(normalizeIpAddress("203.0.113.42"), "203.0.113.42");
  assert.equal(normalizeIpAddress("2001:db8::1"), "2001:db8::1");
  assert.equal(normalizeIpAddress("[2001:db8::1]"), "2001:db8::1");
  assert.equal(normalizeIpAddress("999.999.999.999"), "unknown");
  assert.equal(normalizeIpAddress("::::"), "unknown");
  assert.equal(normalizeIpAddress("not-an-ip"), "unknown");
});

test("normalizes site origins and rejects invalid schemes", () => {
  assert.equal(normalizeSiteOrigin("https://ghostwriter.example/path"), "https://ghostwriter.example");
  assert.equal(normalizeSiteOrigin("javascript:alert(1)"), null);
});

test("treats public sharing as explicit opt-in", () => {
  assert.equal(publicSharingEnabled(undefined), false);
  assert.equal(publicSharingEnabled("false"), false);
  assert.equal(publicSharingEnabled("TRUE"), true);
});

test("local security check loads .env.local without printing secrets", () => {
  const cwd = workspaceTempDir("ghostwriter-security-check-");
  const secret = "local-groq-secret-value";

  writeFileSync(join(cwd, ".env.local"), `GROQ_API_KEY=${secret}\n`);

  const output = execFileSync("node", [SECURITY_CHECK_SCRIPT], {
    cwd,
    encoding: "utf8",
    env: securityCheckEnv({ NODE_ENV: "development" }),
  });

  assert.match(output, /security-check: passed/);
  assert.doesNotMatch(output, new RegExp(secret));
});

test("production security check ignores .env.local and stays explicit", () => {
  const cwd = workspaceTempDir("ghostwriter-security-check-");
  const secret = "local-groq-secret-value";

  writeFileSync(join(cwd, ".env.local"), `GROQ_API_KEY=${secret}\n`);

  assert.throws(
    () =>
      execFileSync("node", [SECURITY_CHECK_SCRIPT], {
        cwd,
        encoding: "utf8",
        env: securityCheckEnv({ AI_ENABLED: "true", NODE_ENV: "production" }),
        stdio: "pipe",
      }),
    (error: unknown) => {
      assert.equal(typeof error, "object");
      assert.notEqual(error, null);

      const stderr = String((error as { stderr?: Buffer | string }).stderr ?? "");

      assert.match(stderr, /AI_ENABLED=true requires a non-placeholder GROQ_API_KEY/);
      assert.doesNotMatch(stderr, new RegExp(secret));
      return true;
    },
  );
});

test("production explicitly disabled AI does not require a provider credential", () => {
  const output = execFileSync("node", [SECURITY_CHECK_SCRIPT], {
    encoding: "utf8",
    env: securityCheckEnv({
      AI_ENABLED: "false",
      GHOSTWRITER_ABUSE_STORE_MODE: "supabase",
      GHOSTWRITER_CLIENT_IP_HEADER: "x-forwarded-for",
      GHOSTWRITER_SECURITY_SECRET: TEST_SIGNING_VALUE,
      GHOSTWRITER_TRUST_PROXY: "true",
      NEXT_PUBLIC_SITE_URL: "https://ghostwriter.example",
      NODE_ENV: "production",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      SUPABASE_URL: "https://supabase.example",
    }),
  });

  assert.match(output, /security-check: passed/);
});

test("production rejects the non-billable E2E fixture mode", () => {
  assert.throws(
    () =>
      execFileSync("node", [SECURITY_CHECK_SCRIPT], {
        encoding: "utf8",
        env: securityCheckEnv({
          AI_ENABLED: "false",
          GHOSTWRITER_ABUSE_STORE_MODE: "supabase",
          GHOSTWRITER_CLIENT_IP_HEADER: "x-forwarded-for",
          GHOSTWRITER_E2E_FIXTURE_MODE: "true",
          GHOSTWRITER_SECURITY_SECRET: TEST_SIGNING_VALUE,
          GHOSTWRITER_TRUST_PROXY: "true",
          NEXT_PUBLIC_SITE_URL: "https://ghostwriter.example",
          NODE_ENV: "production",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
          SUPABASE_URL: "https://supabase.example",
        }),
        stdio: "pipe",
      }),
    (error: unknown) => {
      const stderr = String((error as { stderr?: Buffer | string }).stderr ?? "");
      assert.match(stderr, /GHOSTWRITER_E2E_FIXTURE_MODE must never be enabled in production/);
      return true;
    },
  );
});

test("security check docs match local and CI command behavior", () => {
  const readme = readFileSync(README_PATH, "utf8");
  const workflow = readFileSync(GITHUB_SECURITY_WORKFLOW_PATH, "utf8");

  assert.match(readme, /npm run security:check/);
  assert.match(readme, /\.env\.local/);
  assert.match(readme, /CI runs `npm run security:check` with explicit production environment variables/);
  assert.match(workflow, /npm run security:check/);
  assert.match(workflow, /NODE_ENV: production/);
  assert.match(workflow, /GHOSTWRITER_ABUSE_STORE_MODE: supabase/);
  assert.match(workflow, /GHOSTWRITER_TRUST_PROXY: true/);
  assert.match(workflow, /GHOSTWRITER_CLIENT_IP_HEADER: x-forwarded-for/);
  assert.match(workflow, /AI_ENABLED: false/);
  assert.match(workflow, /gitleaks\/gitleaks-action@[a-f0-9]{40}/);
});
