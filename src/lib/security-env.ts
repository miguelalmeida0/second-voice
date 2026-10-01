import { isIP } from "node:net";

type SecuritySecretResolution = {
  mode: "configured" | "ephemeral" | "missing";
  secret: string | null;
  reason: string | null;
};

export type AbuseStoreMode = "memory" | "supabase";

type AbuseStoreResolution = {
  mode: AbuseStoreMode | null;
  reason: string | null;
};

export type TrustedClientIpHeader =
  | "cf-connecting-ip"
  | "fly-client-ip"
  | "x-forwarded-for"
  | "x-real-ip";

const PLACEHOLDER_SECRET =
  /change_me|dev-only-secret|placeholder|example|replace_me|todo/i;
const TRUSTED_CLIENT_IP_HEADERS = new Set<TrustedClientIpHeader>([
  "cf-connecting-ip",
  "fly-client-ip",
  "x-forwarded-for",
  "x-real-ip",
]);

export function hasStrongSecuritySecret(value: string | undefined | null): boolean {
  const trimmed = value?.trim() ?? "";
  return trimmed.length >= 32 && !PLACEHOLDER_SECRET.test(trimmed);
}

export function resolveSecuritySecret(options: {
  configuredSecret?: string;
  ephemeralSecret?: string;
  nodeEnv?: string;
}): SecuritySecretResolution {
  const nodeEnv = options.nodeEnv ?? "development";
  const configuredSecret = options.configuredSecret?.trim();

  if (hasStrongSecuritySecret(configuredSecret)) {
    return {
      mode: "configured",
      secret: configuredSecret ?? null,
      reason: null,
    };
  }

  if (nodeEnv === "production") {
    return {
      mode: "missing",
      secret: null,
      reason:
        "Set GHOSTWRITER_SECURITY_SECRET to a unique random value with at least 32 characters.",
    };
  }

  const ephemeralSecret = options.ephemeralSecret?.trim();

  if (!ephemeralSecret) {
    return {
      mode: "missing",
      secret: null,
      reason: "Ephemeral development secret unavailable.",
    };
  }

  return {
    mode: "ephemeral",
    secret: ephemeralSecret,
    reason: "Using an ephemeral development secret.",
  };
}

export function shouldTrustProxy(rawValue: string | undefined | null): boolean {
  return (rawValue ?? "").trim().toLowerCase() === "true";
}

export function normalizeTrustedClientIpHeader(
  rawValue: string | undefined | null,
): TrustedClientIpHeader | null {
  const normalized = (rawValue ?? "").trim().toLowerCase();

  if (TRUSTED_CLIENT_IP_HEADERS.has(normalized as TrustedClientIpHeader)) {
    return normalized as TrustedClientIpHeader;
  }

  return null;
}

export function resolveAbuseStoreConfig(options: {
  mode?: string;
  nodeEnv?: string;
  supabaseServiceRoleKey?: string;
  supabaseUrl?: string;
}): AbuseStoreResolution {
  const nodeEnv = options.nodeEnv ?? "development";
  const requestedMode = (options.mode ?? "").trim().toLowerCase();
  const hasSupabaseUrl = Boolean(options.supabaseUrl?.trim());
  const hasServiceRoleKey = Boolean(options.supabaseServiceRoleKey?.trim());

  if (!requestedMode) {
    if (nodeEnv === "production") {
      return {
        mode: null,
        reason: "Set GHOSTWRITER_ABUSE_STORE_MODE to 'supabase' in production.",
      };
    }

    return { mode: "memory", reason: null };
  }

  if (requestedMode === "memory") {
    if (nodeEnv === "production") {
      return {
        mode: null,
        reason:
          "In-memory abuse protection is not sufficient for production. Use GHOSTWRITER_ABUSE_STORE_MODE=supabase.",
      };
    }

    return { mode: "memory", reason: null };
  }

  if (requestedMode !== "supabase") {
    return {
      mode: null,
      reason: "GHOSTWRITER_ABUSE_STORE_MODE must be either 'memory' or 'supabase'.",
    };
  }

  if (!hasSupabaseUrl || !hasServiceRoleKey) {
    return {
      mode: null,
      reason:
        "Supabase abuse protection requires both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  return { mode: "supabase", reason: null };
}

export function normalizeIpAddress(value: string | undefined | null): string {
  const candidate = (value ?? "").trim();

  if (!candidate) {
    return "unknown";
  }

  const normalized = candidate.replace(/^\[|\]$/g, "");

  if (isIP(normalized) === 0) {
    return "unknown";
  }

  return normalized.toLowerCase();
}

export function normalizeSiteOrigin(value: string | undefined | null): string | null {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

export function publicSharingEnabled(rawValue: string | undefined | null): boolean {
  return (rawValue ?? "").trim().toLowerCase() === "true";
}
