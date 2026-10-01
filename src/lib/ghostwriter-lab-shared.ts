import type { AuthorId } from "@/lib/ghostwriter-shared";

export const REWRITE_LAB_RUBRIC_VERSION = "rewrite-lab-rubric-v1" as const;
export const REWRITE_LAB_GENERATOR_PROFILE = "rewrite-lab-candidates-v1" as const;

export const REWRITE_LAB_CANDIDATE_IDS = [
  "faithful",
  "expressive",
  "compressed",
] as const;

export type RewriteLabCandidateId = (typeof REWRITE_LAB_CANDIDATE_IDS)[number];
export type RewriteLabOverreachRisk = "low" | "medium" | "high";
export type RewriteLabSchemaValidation = "passed" | "failed" | "fallback";

export type RewriteLabScoresInput = {
  meaningPreservation: number;
  overreachRisk: RewriteLabOverreachRisk;
  readability: number;
  surprise: number;
  voiceMatch: number;
};

export type RewriteLabScores = RewriteLabScoresInput & {
  overall: number;
};

export type RewriteLabCandidate = {
  artifactToken: string;
  evaluatorNote: string;
  flags: string[];
  id: RewriteLabCandidateId;
  label: string;
  latencyMs: number | null;
  rewrite: string;
  scores: RewriteLabScores;
};

export type RewriteLabWinnerSelection = {
  artifactToken: string;
  label: string;
  overall: number;
  reason: string;
  rewrite: string;
};

export type RewriteLabTrace = {
  candidateCount: 3;
  evaluationLatencyMs: number | null;
  evaluatorRubricVersion: typeof REWRITE_LAB_RUBRIC_VERSION;
  fallbackBehavior: string;
  generationLatencyMs: number;
  generatorPromptProfile: typeof REWRITE_LAB_GENERATOR_PROFILE;
  model: string;
  provider: string;
  schemaValidation: RewriteLabSchemaValidation;
  totalLatencyMs: number;
  winner: RewriteLabCandidateId;
};

export type RewriteLabPayload = {
  candidates: RewriteLabCandidate[];
  selectionReason: string;
  trace: RewriteLabTrace;
  winnerId: RewriteLabCandidateId;
};

export type RewriteLabResponse = {
  error: string | null;
  lab: RewriteLabPayload | null;
};

export type RewriteLabRequest = {
  author: AuthorId;
  baselineRewrite: string;
  challengeNonce: string;
  challengeToken: string;
  mood: number;
  source: string;
};

export const REWRITE_LAB_LABELS: Record<RewriteLabCandidateId, string> = {
  compressed: "Make it shorter",
  expressive: "Add more feeling",
  faithful: "Keep the meaning",
};

export const REWRITE_LAB_SHORT_DESCRIPTIONS: Record<RewriteLabCandidateId, string> = {
  compressed: "Says the same thing with fewer, stronger words.",
  expressive: "Adds more rhythm, color, and emotional texture.",
  faithful: "Stays closest to what you originally meant.",
};

export const OVERREACH_RISK_RANK: Record<RewriteLabOverreachRisk, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export function overreachPenalty(risk: RewriteLabOverreachRisk): number {
  return {
    high: 20,
    low: 100,
    medium: 65,
  }[risk];
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateRewriteLabOverall(scores: RewriteLabScoresInput): number {
  const overall =
    clampScore(scores.meaningPreservation) * 0.34 +
    clampScore(scores.voiceMatch) * 0.24 +
    clampScore(scores.readability) * 0.2 +
    clampScore(scores.surprise) * 0.14 +
    overreachPenalty(scores.overreachRisk) * 0.08;

  return Math.round(overall);
}

function candidatePriority(id: RewriteLabCandidateId): number {
  return REWRITE_LAB_CANDIDATE_IDS.indexOf(id);
}

export function compareRewriteLabCandidates(
  left: Pick<RewriteLabCandidate, "id" | "scores">,
  right: Pick<RewriteLabCandidate, "id" | "scores">,
): number {
  if (left.scores.overall !== right.scores.overall) {
    return right.scores.overall - left.scores.overall;
  }

  if (left.scores.meaningPreservation !== right.scores.meaningPreservation) {
    return right.scores.meaningPreservation - left.scores.meaningPreservation;
  }

  const riskDelta =
    OVERREACH_RISK_RANK[left.scores.overreachRisk] -
    OVERREACH_RISK_RANK[right.scores.overreachRisk];

  if (riskDelta !== 0) {
    return riskDelta;
  }

  if (left.scores.readability !== right.scores.readability) {
    return right.scores.readability - left.scores.readability;
  }

  return candidatePriority(left.id) - candidatePriority(right.id);
}

export function selectRewriteLabWinner(candidates: RewriteLabCandidate[]): RewriteLabCandidateId {
  return [...candidates].sort(compareRewriteLabCandidates)[0]?.id ?? "faithful";
}
