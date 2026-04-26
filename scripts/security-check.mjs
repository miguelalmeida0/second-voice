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

function hasStrongSecret(value) {
  const trimmed = (value ?? "").trim();
  return (
    trimmed.length >= 32 &&
    !/change_me|dev-only-secret|placeholder|example|replace_me|todo/i.test(trimmed)
  );
}

function isPublicSharingEnabled(value) {
  return (value ?? "").trim().toLowerCase() === "true";
}

function fail(message) {
  failures.push(message);
}

const provider = (process.env.GHOSTWRITER_PROVIDER ?? "groq").trim().toLowerCase();
const abuseStoreMode = (process.env.GHOSTWRITER_ABUSE_STORE_MODE ?? "").trim().toLowerCase();
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
const sharingEnabled = isPublicSharingEnabled(process.env.GHOSTWRITER_ALLOW_PUBLIC_SHARING);

if (provider !== "groq" && provider !== "gemini") {
  fail("GHOSTWRITER_PROVIDER must be either 'groq' or 'gemini'.");
}

if (provider === "groq" && !process.env.GROQ_API_KEY?.trim()) {
  fail("GROQ_API_KEY is required when GHOSTWRITER_PROVIDER=groq.");
}

if (provider === "gemini" && !process.env.GEMINI_API_KEY?.trim()) {
  fail("GEMINI_API_KEY is required when GHOSTWRITER_PROVIDER=gemini.");
}

if (isProduction && !hasStrongSecret(process.env.GHOSTWRITER_SECURITY_SECRET)) {
  fail("Production requires a strong GHOSTWRITER_SECURITY_SECRET (32+ random characters).");
}

if (
  isProduction &&
  !["true", "false"].includes((process.env.GHOSTWRITER_TRUST_PROXY ?? "").trim().toLowerCase())
) {
  fail("Set GHOSTWRITER_TRUST_PROXY explicitly to true or false in production.");
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

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`security-check: ${failure}`);
  }

  process.exit(1);
}

console.log("security-check: passed");
