import "../lib/server-only.ts";

import { z } from "zod";

export const REWRITE_PROMPT_VERSION = "single-rewrite-v1" as const;
export const REWRITE_PROVIDER_SCHEMA_VERSION = "openai-chat-choice-v1" as const;
export const REWRITE_QUALITY_GUARD_VERSION = "rewrite-output-guard-v1" as const;
export const REWRITE_OUTPUT_MAX_CHARS = 4_000;

export type RewriteRejectionReason =
  | "empty"
  | "format_violation"
  | "invalid_schema"
  | "too_large";

export type RewriteProviderValidation =
  | {
      guardVersion: typeof REWRITE_QUALITY_GUARD_VERSION;
      ok: true;
      rewrite: string;
      schemaVersion: typeof REWRITE_PROVIDER_SCHEMA_VERSION;
    }
  | {
      guardVersion: typeof REWRITE_QUALITY_GUARD_VERSION;
      ok: false;
      reason: RewriteRejectionReason;
      schemaVersion: typeof REWRITE_PROVIDER_SCHEMA_VERSION;
    };

const ProviderPayloadSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }).passthrough(),
    }).passthrough(),
  ).min(1),
}).passthrough();

const META_WRAPPER_PATTERN =
  /^(?:here(?:'s| is)|sure[,!.:]|certainly[,!.:]|of course[,!.:]|as an ai\b|the rewritten(?: passage| version)? is:?|rewrite(?:n)?(?: passage| version)?:)/i;

function validationBase() {
  return {
    guardVersion: REWRITE_QUALITY_GUARD_VERSION,
    schemaVersion: REWRITE_PROVIDER_SCHEMA_VERSION,
  };
}

export function cleanupRewriteOutput(rewrite: string): string {
  let cleaned = rewrite.trim().replace(/\n{3,}/g, "\n\n");

  if (
    (cleaned.startsWith("\"") && cleaned.endsWith("\"")) ||
    (cleaned.startsWith("\u201c") && cleaned.endsWith("\u201d"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

function hasDisallowedWrapper(rewrite: string): boolean {
  return rewrite.startsWith("```") || META_WRAPPER_PATTERN.test(rewrite);
}

export function validateRewriteProviderPayload(payload: unknown): RewriteProviderValidation {
  const parsed = ProviderPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      ...validationBase(),
      ok: false,
      reason: "invalid_schema",
    };
  }

  const rewrite = cleanupRewriteOutput(parsed.data.choices[0]?.message.content ?? "");

  if (!rewrite) {
    return {
      ...validationBase(),
      ok: false,
      reason: "empty",
    };
  }

  if (rewrite.length > REWRITE_OUTPUT_MAX_CHARS) {
    return {
      ...validationBase(),
      ok: false,
      reason: "too_large",
    };
  }

  if (hasDisallowedWrapper(rewrite)) {
    return {
      ...validationBase(),
      ok: false,
      reason: "format_violation",
    };
  }

  return {
    ...validationBase(),
    ok: true,
    rewrite,
  };
}
