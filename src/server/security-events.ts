type SecurityEventLevel = "info" | "warn" | "error";

type SecurityEventDefinition = {
  alert: boolean;
  category: "abuse" | "config" | "operations" | "privacy" | "provider" | "quality";
  level: SecurityEventLevel;
};

const SECURITY_EVENT_DEFINITIONS: Record<string, SecurityEventDefinition> = {
  abuse_store_error: { alert: true, category: "operations", level: "error" },
  ai_operation_uncertain: { alert: true, category: "operations", level: "error" },
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

const numericFields = new Set(["status","severity","retryAfter","latencyMs","outputChars","mood"]);
const enumValues = new Set(["tolkien","tolstoy","hemingway","stephenking","author","outcome","clarity","reply","confident","concise","persuasive","single_rewrite","rewrite_lab","positive","negative","none","provider_dispatch_failed","provider_rate_limited","provider_rejected","provider_unavailable","settlement_failed","result_persistence_failed","provider_usage_out_of_bounds","abuse_cooldown","protection_unavailable"]);
const enumFields = new Set(["author","rewriteMode","outcome","generationSource","rating","reason"]);
export function sanitizeSecurityDetails(details: Record<string,unknown>) {
  const safe:Record<string,string|number>={};
  for (const [name,value] of Object.entries(details)) {
    if (numericFields.has(name) && typeof value==="number" && Number.isFinite(value) && value>=0 && value<=1e9) safe[name]=value;
    if (enumFields.has(name) && typeof value==="string" && enumValues.has(value)) safe[name]=value;
    if (name==="requestId" && typeof value==="string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) safe[name]=value;
  }
  return safe;
}
// Bounded process-local noise suppression, not a fleet-wide billing cap.
const lastEvents=new Map<string,number>();
let windowStart=0, emitted=0;

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
  const definition = SECURITY_EVENT_DEFINITIONS[event];
  if (!definition) return;
  const time=Date.now();
  if (time<windowStart || time-windowStart>=60_000) {windowStart=time;emitted=0;lastEvents.clear();}
  if (emitted>=60 || (lastEvents.has(event) && time-lastEvents.get(event)!<10_000)) return;
  lastEvents.set(event,time);emitted++;
  const payload = sanitizeSecurityDetails(details);

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
