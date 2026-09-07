import "../lib/server-only.ts";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { resolveSecuritySecret } from "../lib/security-env.ts";
import type { AuthorId, OutcomeId, RewriteMode } from "../lib/ghostwriter-shared.ts";

export type RewriteArtifactGenerationSource = "single_rewrite" | "rewrite_lab";

export type RewriteArtifactTokenInput = {
  author: AuthorId;
  generationSource: RewriteArtifactGenerationSource;
  labSelectionReason: string | null;
  labWinnerLabel: string | null;
  labWinnerScore: number | null;
  mode: RewriteMode;
  mood: number;
  outcome: OutcomeId | null;
  rewrite: string;
  source: string;
};

export type RewriteArtifactVerificationInput = {
  artifactToken: string;
  author: AuthorId;
  mode: RewriteMode;
  mood: number;
  outcome: OutcomeId;
  rewrite: string;
  source?: string;
};

export type VerifiedRewriteArtifact = Omit<
  RewriteArtifactTokenInput,
  "rewrite" | "source"
> & {
  rewriteHash: string;
  sourceHash: string;
};

const ARTIFACT_TOKEN_AUDIENCE = "ghostwriter-rewrite-artifact";
const ARTIFACT_TOKEN_TTL_MS = 30 * 60 * 1000;

const ArtifactTokenPayloadSchema = z
  .object({
    aud: z.literal(ARTIFACT_TOKEN_AUDIENCE),
    author: z.enum(["hemingway", "tolkien", "tolstoy", "stephenking"]),
    exp: z.number().int().positive(),
    generationSource: z.enum(["single_rewrite", "rewrite_lab"]),
    iat: z.number().int().positive(),
    labSelectionReason: z.string().min(1).max(280).nullable(),
    labWinnerLabel: z.string().min(1).max(80).nullable(),
    labWinnerScore: z.number().int().min(0).max(100).nullable(),
    mode: z.enum(["author", "outcome"]),
    mood: z.number().int().min(0).max(100),
    nonce: z.string().min(16).max(64),
    outcome: z.enum(["clarity", "reply", "confident", "concise", "persuasive"]).nullable(),
    rewriteHash: z.string().regex(/^[a-f0-9]{64}$/),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    v: z.literal(1),
  })
  .strict()
  .superRefine((payload, context) => {
    if (payload.mode === "author" && payload.outcome !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Author rewrite artifacts must not carry an outcome.",
        path: ["outcome"],
      });
    }

    if (payload.mode === "outcome" && payload.outcome === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Outcome rewrite artifacts must carry an outcome.",
        path: ["outcome"],
      });
    }

    const labMetadataCount = [
      payload.labWinnerLabel,
      payload.labWinnerScore,
      payload.labSelectionReason,
    ].filter((value) => value !== null).length;
    const hasCompleteLabMetadata = labMetadataCount === 3;

    if (payload.generationSource === "single_rewrite" && labMetadataCount > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Single rewrite artifacts must not carry lab metadata.",
        path: ["generationSource"],
      });
    }

    if (payload.generationSource === "rewrite_lab" && !hasCompleteLabMetadata) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rewrite Lab artifacts must carry complete lab metadata.",
        path: ["generationSource"],
      });
    }
  });

type ArtifactTokenPayload = z.infer<typeof ArtifactTokenPayloadSchema>;

let cachedEphemeralSecret: string | null = null;

function tokenSecret(): string {
  if (!cachedEphemeralSecret) {
    cachedEphemeralSecret = randomBytes(32).toString("base64url");
  }

  const resolved = resolveSecuritySecret({
    configuredSecret: process.env.GHOSTWRITER_SECURITY_SECRET,
    ephemeralSecret: cachedEphemeralSecret,
    nodeEnv: process.env.NODE_ENV,
  });

  if (resolved.secret) {
    return resolved.secret;
  }

  throw new Error(resolved.reason ?? "Security secret unavailable.");
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function safeEqualBase64Url(left: string, right: string): boolean {
  try {
    const leftBuffer = Buffer.from(left, "base64url");
    const rightBuffer = Buffer.from(right, "base64url");

    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", tokenSecret())
    .update(`gw.artifact.${encodedPayload}`)
    .digest("base64url");
}

function normalizeOutcome(mode: RewriteMode, outcome: OutcomeId | null): OutcomeId | null {
  if (mode === "author") {
    return null;
  }

  if (!outcome) {
    throw new Error("Outcome rewrite artifacts require an outcome.");
  }

  return outcome;
}

export function hashRewriteArtifactText(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}

export function issueRewriteArtifactToken(input: RewriteArtifactTokenInput): string {
  const issuedAt = Date.now();
  const payload = ArtifactTokenPayloadSchema.parse({
    aud: ARTIFACT_TOKEN_AUDIENCE,
    author: input.author,
    exp: issuedAt + ARTIFACT_TOKEN_TTL_MS,
    generationSource: input.generationSource,
    iat: issuedAt,
    labSelectionReason: input.labSelectionReason,
    labWinnerLabel: input.labWinnerLabel,
    labWinnerScore: input.labWinnerScore,
    mode: input.mode,
    mood: input.mood,
    nonce: randomBytes(18).toString("base64url"),
    outcome: normalizeOutcome(input.mode, input.outcome),
    rewriteHash: hashRewriteArtifactText(input.rewrite),
    sourceHash: hashRewriteArtifactText(input.source),
    v: 1,
  } satisfies ArtifactTokenPayload);
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyRewriteArtifactToken(
  input: RewriteArtifactVerificationInput,
): VerifiedRewriteArtifact | null {
  const [encodedPayload, signature, extra] = input.artifactToken.split(".");

  if (!encodedPayload || !signature || extra !== undefined) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);

  if (!safeEqualBase64Url(signature, expectedSignature)) {
    return null;
  }

  let payload: ArtifactTokenPayload;

  try {
    payload = ArtifactTokenPayloadSchema.parse(JSON.parse(base64UrlDecode(encodedPayload)));
  } catch {
    return null;
  }

  const expectedOutcome = input.mode === "outcome" ? input.outcome : null;

  if (
    payload.exp <= Date.now() ||
    payload.author !== input.author ||
    payload.mode !== input.mode ||
    payload.mood !== input.mood ||
    payload.outcome !== expectedOutcome ||
    payload.rewriteHash !== hashRewriteArtifactText(input.rewrite)
  ) {
    return null;
  }

  if (input.source !== undefined && payload.sourceHash !== hashRewriteArtifactText(input.source)) {
    return null;
  }

  return {
    author: payload.author,
    generationSource: payload.generationSource,
    labSelectionReason: payload.labSelectionReason,
    labWinnerLabel: payload.labWinnerLabel,
    labWinnerScore: payload.labWinnerScore,
    mode: payload.mode,
    mood: payload.mood,
    outcome: payload.outcome,
    rewriteHash: payload.rewriteHash,
    sourceHash: payload.sourceHash,
  };
}

export function __resetRewriteArtifactTokenForTests() {
  cachedEphemeralSecret = null;
}
