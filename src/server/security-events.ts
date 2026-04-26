import { createHash } from "node:crypto";

type SecurityEventLevel = "info" | "warn" | "error";

type SecurityEventDefinition = {
  alert: boolean;
  category: "abuse" | "config" | "operations" | "privacy" | "provider" | "quality";
  level: SecurityEventLevel;
};

const SECURITY_EVENT_DEFINITIONS: Record<string, SecurityEventDefinition> = {
  abuse_store_error: { alert: true, category: "operations", level: "error" },
  ai_provider_error: { alert: false, category: "provider", level: "warn" },
  ai_provider_output_rejected: { alert: true, category: "provider", level: "warn" },
  challenge_replay_detected: { alert: true, category: "abuse", level: "warn" },
  feedback_storage_unavailable: { alert: true, category: "operations", level: "error" },
  public_share_created: { alert: false, category: "privacy", level: "info" },
  public_share_failed: { alert: true, category: "operations", level: "warn" },
  public_share_read_failed: { alert: true, category: "operations", level: "warn" },
  request_blocked: { alert: false, category: "abuse", level: "warn" },
  rewrite_completed: { alert: false, category: "quality", level: "info" },
  rewrite_feedback_failed: { alert: true, category: "operations", level: "warn" },
  rewrite_feedback_recorded: { alert: false, category: "quality", level: "info" },
  rewrite_failed: { alert: false, category: "provider", level: "warn" },
  rewrite_lab_completed: { alert: false, category: "quality", level: "info" },
  security_config_error: { alert: true, category: "config", level: "error" },
  security_config_warning: { alert: true, category: "config", level: "warn" },
  share_storage_unavailable: { alert: true, category: "operations", level: "error" },
};

function maskValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.length <= 8) {
    return `sha256:${createHash("sha256").update(trimmed).digest("hex").slice(0, 10)}`;
  }

  return `${trimmed.slice(0, 3)}…${trimmed.slice(-3)}`;
}

function consoleForLevel(level: SecurityEventLevel) {
  if (level === "error") {
    return console.error;
  }

  if (level === "info") {
    return console.info;
  }

  return console.warn;
}

export function logSecurityEvent(event: string, details: Record<string, unknown>) {
  const definition = SECURITY_EVENT_DEFINITIONS[event] ?? {
    alert: false,
    category: "operations",
    level: "warn" as const,
  };

  const payload = Object.fromEntries(
    Object.entries(details).map(([key, value]) => [
      key,
      /cookie|csrf|challenge|ip|key|secret|session|token|userAgent/i.test(key)
        ? maskValue(value)
        : value,
    ]),
  );

  consoleForLevel(definition.level)(
    JSON.stringify({
      alert: definition.alert,
      category: definition.category,
      event,
      level: definition.level,
      service: "ghostwriter",
      timestamp: new Date().toISOString(),
      ...payload,
    }),
  );
}
