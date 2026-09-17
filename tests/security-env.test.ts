import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  hasStrongSecuritySecret,
  normalizeSiteOrigin,
  normalizeIpAddress,
  publicSharingEnabled,
  resolveAbuseStoreConfig,
  resolveSecuritySecret,
  selectAiProvider,
  shouldTrustProxy,
} from "../src/lib/security-env.ts";

const SECURITY_CHECK_SCRIPT = fileURLToPath(new URL("../scripts/security-check.mjs", import.meta.url));
const README_PATH = new URL("../README.md", import.meta.url);
const SECURITY_DOC_PATH = new URL("../docs/SECURITY.md", import.meta.url);
const GITHUB_SECURITY_WORKFLOW_PATH = new URL(
  "../.github/workflows/security.yml",
  import.meta.url,
);

const SECURITY_CHECK_ENV_KEYS = [
  "GEMINI_API_KEY",
  "GHOSTWRITER_ABUSE_STORE_MODE",
  "GHOSTWRITER_ALLOW_PUBLIC_SHARING",
  "GHOSTWRITER_PROVIDER",
  "GHOSTWRITER_SECURITY_SECRET",
  "GHOSTWRITER_TRUST_PROXY",
  "GROQ_API_KEY",
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

test("does not silently fall back to gemini when groq is selected", () => {
  const selected = selectAiProvider({
    geminiApiKey: "gemini-key",
    geminiModel: "gemini-model",
    geminiUrl: "https://gemini.example",
    groqApiKey: "",
    groqModel: "groq-model",
    groqUrl: "https://groq.example",
    preferredProvider: "groq",
  });

  assert.equal(selected, null);
});

test("uses explicit gemini selection when configured", () => {
  const selected = selectAiProvider({
    geminiApiKey: "gemini-key",
    geminiModel: "gemini-model",
    geminiUrl: "https://gemini.example",
    groqApiKey: "groq-key",
    groqModel: "groq-model",
    groqUrl: "https://groq.example",
    preferredProvider: "gemini",
  });

  assert.deepEqual(selected, {
    apiKey: "gemini-key",
    model: "gemini-model",
    name: "gemini",
    url: "https://gemini.example",
  });
});

test("does not trust proxy headers by default", () => {
  assert.equal(shouldTrustProxy(undefined), false);
  assert.equal(shouldTrustProxy("false"), false);
  assert.equal(shouldTrustProxy("true"), true);
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
  const cwd = mkdtempSync(join(tmpdir(), "ghostwriter-security-check-"));
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
  const cwd = mkdtempSync(join(tmpdir(), "ghostwriter-security-check-"));
  const secret = "local-groq-secret-value";

  writeFileSync(join(cwd, ".env.local"), `GROQ_API_KEY=${secret}\n`);

  assert.throws(
    () =>
      execFileSync("node", [SECURITY_CHECK_SCRIPT], {
        cwd,
        encoding: "utf8",
        env: securityCheckEnv({ NODE_ENV: "production" }),
        stdio: "pipe",
      }),
    (error: unknown) => {
      assert.equal(typeof error, "object");
      assert.notEqual(error, null);

      const stderr = String((error as { stderr?: Buffer | string }).stderr ?? "");

      assert.match(stderr, /GROQ_API_KEY is required when GHOSTWRITER_PROVIDER=groq/);
      assert.doesNotMatch(stderr, new RegExp(secret));
      return true;
    },
  );
});

test("README links to the dedicated security setup documentation", () => {
  const readme = readFileSync(README_PATH, "utf8");

  assert.match(readme, /docs\/SECURITY\.md/);
});

test("security documentation covers the local and CI security contract", () => {
  const securityDoc = readFileSync(SECURITY_DOC_PATH, "utf8");

  // Local: .env.local is the documented way to supply credentials, and
  // npm run security:check is the documented way to validate them.
  assert.match(securityDoc, /\.env\.local/);
  assert.match(securityDoc, /npm run security:check/);

  // CI: must not depend on .env.local, and must document that production
  // configuration fails closed rather than silently degrading.
  assert.match(securityDoc, /does not rely on `?\.env\.local`?/i);
  assert.match(securityDoc, /production/i);
  assert.match(securityDoc, /fails? closed/i);
});

test("CI workflow enforces the durable security contract", () => {
  const workflow = readFileSync(GITHUB_SECURITY_WORKFLOW_PATH, "utf8");

  assert.match(workflow, /npm run security:check/);
  assert.match(workflow, /NODE_ENV:\s*production/);
  assert.match(workflow, /GHOSTWRITER_ABUSE_STORE_MODE:\s*supabase/);
  assert.match(workflow, /npm audit/);
});
