import "../lib/server-only.ts";

import { z } from "zod";
import type { AuthorId } from "@/lib/ghostwriter-shared";
import {
  REWRITE_LAB_CANDIDATE_IDS,
  REWRITE_LAB_GENERATOR_PROFILE,
  REWRITE_LAB_LABELS,
  REWRITE_LAB_RUBRIC_VERSION,
  calculateRewriteLabOverall,
  selectRewriteLabWinner,
  type RewriteLabCandidate,
  type RewriteLabCandidateId,
  type RewriteLabOverreachRisk,
  type RewriteLabPayload,
  type RewriteLabScoresInput,
  type RewriteLabSchemaValidation,
} from "@/lib/ghostwriter-lab-shared";
import {
  buildPrompt,
  cleanupRewriteOutput,
  getProviderConfig,
  type ProviderConfig,
} from "@/server/ghostwriter";
import { readLimitedJsonResponse } from "@/server/ai-provider-http";
import { logSecurityEvent } from "@/server/security-events";

const LAB_SOURCE_MAX_LENGTH = 1200;
const CANDIDATE_TIMEOUT_MS = 14_000;
const EVALUATOR_TIMEOUT_MS = 10_000;
const PROVIDER_RESPONSE_MAX_BYTES = 64 * 1024;
const CANDIDATE_MAX_TOKENS = 700;
const CANDIDATE_OUTPUT_MAX_CHARS = 4_000;
const EVALUATOR_MAX_TOKENS = 700;

type RewriteLabContext = {
  requestId?: string;
};

export const RewriteLabInputSchema = z.object({
  author: z.enum(["hemingway", "tolkien", "tolstoy", "stephenking"]),
  baselineRewrite: z.string().trim().min(1).max(3000),
  mood: z.number().int().min(0).max(100).default(50),
  source: z.string().trim().min(1).max(LAB_SOURCE_MAX_LENGTH),
});

const EvaluationFlagSchema = z.enum([
  "invented_fact",
  "changed_meaning",
  "too_plain",
  "too_stylized",
  "awkward_phrasing",
  "strong_candidate",
]);

const CandidateEvaluationSchema = z.object({
  evaluatorNote: z.string().min(1).max(220),
  flags: z.array(EvaluationFlagSchema).max(4),
  id: z.enum(REWRITE_LAB_CANDIDATE_IDS),
  scores: z.object({
    meaningPreservation: z.number().int().min(0).max(100),
    overreachRisk: z.enum(["low", "medium", "high"]),
    readability: z.number().int().min(0).max(100),
    surprise: z.number().int().min(0).max(100),
    voiceMatch: z.number().int().min(0).max(100),
  }),
});

const EvaluationSchema = z.object({
  candidates: z.array(CandidateEvaluationSchema).min(1).max(3),
  rubricVersion: z.literal(REWRITE_LAB_RUBRIC_VERSION),
  selectionReason: z.string().min(1).max(220),
  winnerId: z.enum(REWRITE_LAB_CANDIDATE_IDS),
});

type CandidateProfile = {
  direction: string;
  id: RewriteLabCandidateId;
  temperature: number;
};

type GeneratedCandidate = {
  id: RewriteLabCandidateId;
  latencyMs: number;
  rewrite: string;
};

type EvaluatorResult = z.infer<typeof EvaluationSchema>;

const CANDIDATE_PROFILES: CandidateProfile[] = [
  {
    id: "faithful",
    temperature: 0.55,
    direction:
      "Rewrite the passage in the selected voice, but prioritize semantic preservation and clarity. Stay close to the source. Avoid adding new facts, new emotional stakes, or extra imagery unless the source implies them.",
  },
  {
    id: "expressive",
    temperature: 0.82,
    direction:
      "Rewrite the passage with a stronger author lens. Let rhythm, imagery, and sentence texture become more visible, while preserving the original meaning and point of view.",
  },
  {
    id: "compressed",
    temperature: 0.48,
    direction:
      "Rewrite the passage in a more compressed form. Keep the emotional and factual core, remove slack, and preserve the selected voice with as few words as possible.",
  },
];

function elapsed(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

async function fetchProviderJson(
  provider: ProviderConfig,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ choices?: Array<{ message?: { content?: string } }> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(provider.url, {
      body: JSON.stringify(body),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Provider returned ${response.status}`);
    }

    return (await readLimitedJsonResponse(response, PROVIDER_RESPONSE_MAX_BYTES, {
      signal: controller.signal,
    })) as { choices?: Array<{ message?: { content?: string } }> };
  } finally {
    clearTimeout(timeout);
  }
}

function buildCandidateSystemPrompt(author: AuthorId, mood: number, profile: CandidateProfile) {
  const base = buildPrompt(author, mood);

  return {
    moodLabel: base.moodLabel,
    system: `${base.system}

Rewrite Lab candidate profile:
${REWRITE_LAB_LABELS[profile.id]}.
${profile.direction}

Candidate rules:
- Return only the candidate rewrite.
- Do not explain, score, or compare.
- Do not mention Rewrite Lab.`,
  };
}

async function generateCandidate({
  author,
  mood,
  profile,
  provider,
  source,
}: {
  author: AuthorId;
  mood: number;
  profile: CandidateProfile;
  provider: ProviderConfig;
  source: string;
}): Promise<GeneratedCandidate> {
  const startedAt = Date.now();
  const { system } = buildCandidateSystemPrompt(author, mood, profile);
  const json = await fetchProviderJson(
    provider,
    {
      messages: [
        { content: system, role: "system" },
        { content: source, role: "user" },
      ],
      max_tokens: CANDIDATE_MAX_TOKENS,
      model: provider.model,
      temperature: profile.temperature,
    },
    CANDIDATE_TIMEOUT_MS,
  );
  const rewrite = cleanupRewriteOutput(json.choices?.[0]?.message?.content ?? "");

  if (!rewrite || rewrite.length > CANDIDATE_OUTPUT_MAX_CHARS) {
    throw new Error(`${profile.id} returned an empty or oversized candidate`);
  }

  return {
    id: profile.id,
    latencyMs: elapsed(startedAt),
    rewrite,
  };
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseEvaluatorJson(value: string): unknown {
  const stripped = stripJsonFence(value);

  try {
    return JSON.parse(stripped);
  } catch {
    const objectMatch = stripped.match(/\{[\s\S]*\}/);

    if (!objectMatch) {
      throw new Error("Evaluator returned non-JSON content");
    }

    return JSON.parse(objectMatch[0]);
  }
}

async function evaluateCandidates({
  author,
  candidates,
  moodLabel,
  provider,
  source,
}: {
  author: AuthorId;
  candidates: GeneratedCandidate[];
  moodLabel: string;
  provider: ProviderConfig;
  source: string;
}): Promise<EvaluatorResult> {
  const json = await fetchProviderJson(
    provider,
    {
      messages: [
        {
          content:
            "You are an evaluator for a literary rewrite system. Grade candidate rewrites against the source text using the supplied rubric. Return only valid JSON matching the schema. Prefer semantic preservation over stylistic intensity when there is a conflict. Do not reveal private reasoning. Use concise public evaluator notes only.",
          role: "system",
        },
        {
          content: JSON.stringify({
            author,
            candidates: candidates.map((candidate) => ({
              id: candidate.id,
              label: REWRITE_LAB_LABELS[candidate.id],
              rewrite: candidate.rewrite,
            })),
            moodLabel,
            requiredJsonShape: {
              candidates:
                "array of { id, scores: { meaningPreservation, voiceMatch, readability, surprise, overreachRisk }, evaluatorNote, flags }",
              rubricVersion: REWRITE_LAB_RUBRIC_VERSION,
              selectionReason: "short public explanation, max 220 chars",
              winnerId: "faithful | expressive | compressed",
            },
            rubric: {
              meaningPreservation:
                "Preserves the user's original meaning, facts, intent, and point of view.",
              overreachRisk:
                "low, medium, or high risk of adding too much, distorting the source, or over-styling.",
              readability: "Clear, fluent, and pleasant to read.",
              surprise: "Fresh phrasing instead of a bland paraphrase.",
              voiceMatch: "Selected author lens and mood band without parody.",
            },
            source,
          }),
          role: "user",
        },
      ],
      max_tokens: EVALUATOR_MAX_TOKENS,
      model: provider.model,
      response_format: { type: "json_object" },
      temperature: 0.15,
    },
    EVALUATOR_TIMEOUT_MS,
  );
  const content = json.choices?.[0]?.message?.content ?? "";
  const parsed = EvaluationSchema.parse(parseEvaluatorJson(content));
  const generatedIds = new Set(candidates.map((candidate) => candidate.id));
  const evaluatedIds = new Set(parsed.candidates.map((candidate) => candidate.id));

  if (!generatedIds.has(parsed.winnerId)) {
    throw new Error("Evaluator selected an unknown winner");
  }

  for (const candidate of candidates) {
    if (!evaluatedIds.has(candidate.id)) {
      throw new Error(`Evaluator skipped ${candidate.id}`);
    }
  }

  return parsed;
}

function words(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function overlapRatio(source: string, candidate: string): number {
  const sourceWords = new Set(words(source));
  const candidateWords = new Set(words(candidate));

  if (sourceWords.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const word of sourceWords) {
    if (candidateWords.has(word)) {
      overlap += 1;
    }
  }

  return overlap / sourceWords.size;
}

function lengthCloseness(source: string, candidate: string): number {
  const sourceLength = Math.max(1, words(source).length);
  const candidateLength = Math.max(1, words(candidate).length);
  const ratio = candidateLength / sourceLength;

  return Math.max(0, 1 - Math.abs(1 - ratio));
}

function fallbackRisk(id: RewriteLabCandidateId, source: string, rewrite: string): RewriteLabOverreachRisk {
  const sourceLength = Math.max(1, words(source).length);
  const rewriteLength = Math.max(1, words(rewrite).length);
  const ratio = rewriteLength / sourceLength;

  if (ratio > 1.75 || (id === "expressive" && ratio > 1.45)) {
    return "high";
  }

  if (ratio > 1.32 || ratio < 0.52) {
    return "medium";
  }

  return "low";
}

function fallbackScores(candidate: GeneratedCandidate, source: string): RewriteLabScoresInput {
  const overlap = overlapRatio(source, candidate.rewrite);
  const closeness = lengthCloseness(source, candidate.rewrite);
  const risk = fallbackRisk(candidate.id, source, candidate.rewrite);
  const voiceBase = {
    compressed: 70,
    expressive: 84,
    faithful: 74,
  }[candidate.id];
  const surpriseBase = {
    compressed: 58,
    expressive: 82,
    faithful: 52,
  }[candidate.id];

  return {
    meaningPreservation: Math.round(58 + overlap * 30 + closeness * 12),
    overreachRisk: risk,
    readability: Math.round(68 + closeness * 24 - (risk === "high" ? 10 : 0)),
    surprise: surpriseBase,
    voiceMatch: voiceBase,
  };
}

function toLabCandidate(
  generated: GeneratedCandidate,
  evaluation: z.infer<typeof CandidateEvaluationSchema>,
): RewriteLabCandidate {
  const scores = {
    ...evaluation.scores,
    overall: calculateRewriteLabOverall(evaluation.scores),
  };

  return {
    evaluatorNote: evaluation.evaluatorNote,
    flags: evaluation.flags,
    id: generated.id,
    label: REWRITE_LAB_LABELS[generated.id],
    latencyMs: generated.latencyMs,
    rewrite: generated.rewrite,
    scores,
  };
}

function buildFallbackCandidates(candidates: GeneratedCandidate[], source: string): RewriteLabCandidate[] {
  return candidates.map((candidate) => {
    const scoresInput = fallbackScores(candidate, source);

    return {
      evaluatorNote:
        "Selected with deterministic fallback scoring because the evaluator response could not be trusted.",
      flags: ["strong_candidate"],
      id: candidate.id,
      label: REWRITE_LAB_LABELS[candidate.id],
      latencyMs: candidate.latencyMs,
      rewrite: candidate.rewrite,
      scores: {
        ...scoresInput,
        overall: calculateRewriteLabOverall(scoresInput),
      },
    };
  });
}

function selectionReasonFor(winnerId: RewriteLabCandidateId, schemaValidation: RewriteLabSchemaValidation) {
  const label = REWRITE_LAB_LABELS[winnerId];

  if (schemaValidation === "passed") {
    return `${label} won because it had the strongest weighted balance of meaning, voice, readability, surprise, and risk.`;
  }

  return `${label} was selected by deterministic fallback scoring after the evaluator response could not be used.`;
}

export async function runRewriteLab(
  data: z.infer<typeof RewriteLabInputSchema>,
  context: RewriteLabContext = {},
): Promise<{
  error: string | null;
  lab: RewriteLabPayload | null;
  status: number;
}> {
  const provider = getProviderConfig();
  const totalStartedAt = Date.now();
  const moodLabel = buildPrompt(data.author, data.mood).moodLabel;

  if (!provider) {
    return {
      error: "Rewrite Lab unavailable.",
      lab: null,
      status: 503,
    };
  }

  const generationStartedAt = Date.now();
  const generatedResults = await Promise.allSettled(
    CANDIDATE_PROFILES.map((profile) =>
      generateCandidate({
        author: data.author,
        mood: data.mood,
        profile,
        provider,
        source: data.source,
      }),
    ),
  );
  const generationLatencyMs = elapsed(generationStartedAt);
  const candidates = generatedResults
    .filter((result): result is PromiseFulfilledResult<GeneratedCandidate> => result.status === "fulfilled")
    .map((result) => result.value);
  const failedCandidateCount = generatedResults.length - candidates.length;

  if (candidates.length === 0) {
    logSecurityEvent("rewrite_lab_generation_failed", {
      provider: provider.label,
      requestId: context.requestId,
    });

    return {
      error: "Rewrite Lab could not finish this run. The original rewrite is still available.",
      lab: null,
      status: 502,
    };
  }

  let evaluationLatencyMs: number | null = null;
  let fallbackBehavior =
    failedCandidateCount > 0
      ? `${failedCandidateCount} candidate failed; evaluated remaining candidates`
      : "none";
  let schemaValidation: RewriteLabSchemaValidation = "fallback";
  let labCandidates: RewriteLabCandidate[];
  let selectionReason: string | null = null;

  try {
    const evaluationStartedAt = Date.now();
    const evaluation = await evaluateCandidates({
      author: data.author,
      candidates,
      moodLabel,
      provider,
      source: data.source,
    });
    evaluationLatencyMs = elapsed(evaluationStartedAt);
    schemaValidation = "passed";
    labCandidates = candidates.map((generated) => {
      const evaluationCandidate = evaluation.candidates.find((candidate) => candidate.id === generated.id);

      if (!evaluationCandidate) {
        throw new Error(`Missing evaluation for ${generated.id}`);
      }

      return toLabCandidate(generated, evaluationCandidate);
    });
    selectionReason = evaluation.selectionReason;
  } catch (error) {
    schemaValidation = "fallback";
    fallbackBehavior =
      failedCandidateCount > 0
        ? `${failedCandidateCount} candidate failed; evaluator failed; selected fallback candidate`
        : "Evaluator schema validation failed; selected fallback candidate";
    labCandidates = buildFallbackCandidates(candidates, data.source);
    logSecurityEvent("rewrite_lab_evaluator_fallback", {
      error: error instanceof Error ? error.message : "unknown",
      provider: provider.label,
      requestId: context.requestId,
    });
  }

  const winnerId = selectRewriteLabWinner(labCandidates);

  const trace = {
    candidateCount: 3,
    evaluationLatencyMs,
    evaluatorRubricVersion: REWRITE_LAB_RUBRIC_VERSION,
    fallbackBehavior,
    generationLatencyMs,
    generatorPromptProfile: REWRITE_LAB_GENERATOR_PROFILE,
    model: provider.model,
    provider: provider.label,
    schemaValidation,
    totalLatencyMs: elapsed(totalStartedAt),
    winner: winnerId,
  } satisfies RewriteLabPayload["trace"];

  logSecurityEvent("rewrite_lab_completed", {
    candidateCount: trace.candidateCount,
    evaluationLatencyMs: trace.evaluationLatencyMs,
    fallbackBehavior: trace.fallbackBehavior,
    generationLatencyMs: trace.generationLatencyMs,
    model: trace.model,
    provider: trace.provider,
    requestId: context.requestId,
    schemaValidation: trace.schemaValidation,
    totalLatencyMs: trace.totalLatencyMs,
    winner: trace.winner,
  });

  return {
    error: null,
    lab: {
      candidates: labCandidates,
      selectionReason: selectionReason || selectionReasonFor(winnerId, schemaValidation),
      trace,
      winnerId,
    },
    status: 200,
  };
}
