import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function cleanEnvValue(rawValue) {
  const value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value.replace(/\s+#.*$/, "").trim();
}

function loadLocalEnvFile() {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const envPath = resolve(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  const envFile = readFileSync(envPath, "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = cleanEnvValue(rawValue);
  }
}

loadLocalEnvFile();

const isProduction = process.env.NODE_ENV === "production";
const failures = [];
const AI_PRICING_VERSION = "groq-openai-gpt-oss-20b-2026-09-07";
const AI_MODEL = "openai/gpt-oss-20b";
const PLACEHOLDER = /change_me|dev-only-secret|placeholder|example|replace_me|todo|ci-placeholder/i;

function hasStrongSecret(value) {
  const trimmed = (value ?? "").trim();
  return trimmed.length >= 32 && !PLACEHOLDER.test(trimmed);
}

function isPublicSharingEnabled(value) {
  return (value ?? "").trim().toLowerCase() === "true";
}

function fail(message) {
  failures.push(message);
}

const aiEnabled = (process.env.AI_ENABLED ?? "").trim().toLowerCase() === "true";
const abuseStoreMode = (process.env.GHOSTWRITER_ABUSE_STORE_MODE ?? "").trim().toLowerCase();
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
const sharingEnabled = isPublicSharingEnabled(process.env.GHOSTWRITER_ALLOW_PUBLIC_SHARING);
const trustedClientIpHeader = (process.env.GHOSTWRITER_CLIENT_IP_HEADER ?? "")
  .trim()
  .toLowerCase();

if (isProduction && !hasStrongSecret(process.env.GHOSTWRITER_SECURITY_SECRET)) {
  fail("Production requires a strong GHOSTWRITER_SECURITY_SECRET (32+ random characters).");
}

if (isProduction && (process.env.GHOSTWRITER_TRUST_PROXY ?? "").trim().toLowerCase() !== "true") {
  fail("Production requires GHOSTWRITER_TRUST_PROXY=true so AI abuse limits can bind to a stable client IP.");
}

if (
  isProduction &&
  !["cf-connecting-ip", "fly-client-ip", "x-forwarded-for", "x-real-ip"].includes(
    trustedClientIpHeader,
  )
) {
  fail(
    "Production requires GHOSTWRITER_CLIENT_IP_HEADER to be one of cf-connecting-ip, fly-client-ip, x-forwarded-for, or x-real-ip.",
  );
}

if (isProduction && abuseStoreMode !== "supabase") {
  fail("Production requires GHOSTWRITER_ABUSE_STORE_MODE=supabase.");
}

if (abuseStoreMode === "supabase") {
  if (!process.env.SUPABASE_URL?.trim()) {
    fail("SUPABASE_URL is required when GHOSTWRITER_ABUSE_STORE_MODE=supabase.");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    fail(
      "SUPABASE_SERVICE_ROLE_KEY is required when GHOSTWRITER_ABUSE_STORE_MODE=supabase.",
    );
  }
}

if (isProduction && !siteUrl) {
  fail("NEXT_PUBLIC_SITE_URL is required in production.");
}

if (siteUrl && !siteUrl.startsWith("https://") && isProduction) {
  fail("NEXT_PUBLIC_SITE_URL must use https in production.");
}

if (sharingEnabled) {
  if (!process.env.SUPABASE_URL?.trim()) {
    fail("SUPABASE_URL is required when public sharing is enabled.");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    fail("SUPABASE_SERVICE_ROLE_KEY is required when public sharing is enabled.");
  }

  if (!process.env.SUPABASE_PUBLISHABLE_KEY?.trim()) {
    fail("SUPABASE_PUBLISHABLE_KEY is required when public sharing is enabled.");
  }
}

if (isProduction && sharingEnabled) {
  fail("Closed-beta production requires GHOSTWRITER_ALLOW_PUBLIC_SHARING=false.");
}

if (
  isProduction &&
  (process.env.GHOSTWRITER_E2E_FIXTURE_MODE ?? "").trim().toLowerCase() === "true"
) {
  fail("GHOSTWRITER_E2E_FIXTURE_MODE must never be enabled in production.");
}

function requireExact(name, expected) {
  if ((process.env[name] ?? "").trim() !== expected) {
    fail(`${name} must equal the audited value '${expected}' when AI is enabled.`);
  }
}

function requirePositiveInteger(name, maximum) {
  const raw = (process.env[name] ?? "").trim();

  if (!/^\d+$/.test(raw)) {
    fail(`${name} must be an explicit positive integer when AI is enabled.`);
    return;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum && parsed > maximum)) {
    fail(`${name} is outside the audited range.`);
  }
}

if (aiEnabled) {
  requireExact("GHOSTWRITER_PROVIDER", "groq");
  requireExact("GROQ_MODEL", AI_MODEL);
  requireExact("GHOSTWRITER_AI_PRICING_VERSION", AI_PRICING_VERSION);

  if (!process.env.GROQ_API_KEY?.trim() || PLACEHOLDER.test(process.env.GROQ_API_KEY)) {
    fail("AI_ENABLED=true requires a non-placeholder GROQ_API_KEY.");
  }

  if (abuseStoreMode !== "supabase") {
    fail("AI_ENABLED=true requires GHOSTWRITER_ABUSE_STORE_MODE=supabase.");
  }

  if (!process.env.SUPABASE_PUBLISHABLE_KEY?.trim()) {
    fail("AI_ENABLED=true requires SUPABASE_PUBLISHABLE_KEY for server-side user verification.");
  }

  const boundedIntegers = [
    ["GHOSTWRITER_BETA_MAX_APPROVED_ACCOUNTS", 25],
    ["GHOSTWRITER_AI_LIFETIME_GENERATIONS_PER_ACCOUNT", 10],
    ["GHOSTWRITER_AI_ACCOUNT_GENERATIONS_PER_24H", 5],
    ["GHOSTWRITER_AI_ACCOUNT_GENERATIONS_PER_MINUTE", 3],
    ["GHOSTWRITER_AI_ACCOUNT_CONCURRENCY", 1],
    ["GHOSTWRITER_AI_GLOBAL_GENERATIONS_PER_MINUTE", 10],
    ["GHOSTWRITER_AI_GLOBAL_CONCURRENCY", 2],
    ["GHOSTWRITER_AI_MAX_INPUT_TOKENS", 2000],
    ["GHOSTWRITER_AI_MAX_OUTPUT_TOKENS", 2000],
    ["GHOSTWRITER_AI_MAX_OPERATION_MICRO_USD", 10000],
    ["GHOSTWRITER_AI_HOURLY_BUDGET_MICRO_USD", 500000],
    ["GHOSTWRITER_AI_24H_BUDGET_MICRO_USD", 2000000],
    ["GHOSTWRITER_AI_BETA_LIFETIME_BUDGET_MICRO_USD", 10000000],
    ["GHOSTWRITER_AI_REQUEST_BODY_BYTES", 10000],
    ["GHOSTWRITER_AI_REQUEST_TIMEOUT_MS", 30000],
  ];

  for (const [name, maximum] of boundedIntegers) {
    requirePositiveInteger(name, maximum);
  }

  requireExact("GHOSTWRITER_AI_REQUEST_BODY_BYTES", "10000");
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`security-check: ${failure}`);
  }

  process.exit(1);
}

console.log("security-check: passed");
