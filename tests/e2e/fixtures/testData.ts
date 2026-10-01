import type { RewriteLabPayload } from "../../../src/lib/ghostwriter-lab-shared";

export const drafts = {
  default:
    "If you are reading this on a hard day, please remember that being tired is not the same thing as failing.",
  emptyStateProbe: "A tiny line for the empty state.",
  outcome: "Can you send the notes today so I can finish the proposal before the review?",
  rewrite:
    "When the day grows heavy, remember this: weariness is not defeat, nor does the long road mean you have failed.",
};

export const apiResponses = {
  artifactToken: "playwright-single-rewrite-artifact-token",
  requestId: "req-playwright-e2e",
  rewrite:
    "When the day grows heavy, remember this: weariness is not defeat, nor does the long road mean you have failed.",
  shareId: "e2eshare",
};

export const caseStudyTreatments = {
  plainer: "The app uses AI to help people hear another version of their own sentence.",
  stranger:
    "The model becomes a second ear: not replacing the sentence, just letting it echo differently.",
  warmer:
    "AI writing does not have to be only about speed. It can also help a sentence feel more alive.",
};

export const labPayload: RewriteLabPayload = {
  candidates: [
    {
      artifactToken: "playwright-lab-faithful-artifact-token",
      evaluatorNote: "Preserves the promise and gives it a mythic cadence.",
      flags: ["faithful", "clear"],
      id: "faithful",
      label: "Keep the meaning",
      latencyMs: 211,
      rewrite:
        "If this finds you on a hard day, remember: being weary is not the same as being beaten.",
      scores: {
        meaningPreservation: 96,
        overreachRisk: "low",
        overall: 94,
        readability: 92,
        surprise: 82,
        voiceMatch: 95,
      },
    },
    {
      artifactToken: "playwright-lab-expressive-artifact-token",
      evaluatorNote: "Adds a little lift without drifting from the source.",
      flags: ["expressive"],
      id: "expressive",
      label: "Add more feeling",
      latencyMs: 244,
      rewrite:
        "If the day has found you bent beneath its weight, remember this gently: tired is not failed.",
      scores: {
        meaningPreservation: 91,
        overreachRisk: "medium",
        overall: 88,
        readability: 88,
        surprise: 92,
        voiceMatch: 89,
      },
    },
    {
      artifactToken: "playwright-lab-compressed-artifact-token",
      evaluatorNote: "Very clear, though less voice-rich than the winner.",
      flags: ["short"],
      id: "compressed",
      label: "Make it shorter",
      latencyMs: 198,
      rewrite: "A hard day can tire you. It does not mean you failed.",
      scores: {
        meaningPreservation: 89,
        overreachRisk: "low",
        overall: 86,
        readability: 97,
        surprise: 70,
        voiceMatch: 80,
      },
    },
  ],
  selectionReason: "The faithful version keeps the source intact while adding the strongest voice.",
  trace: {
    candidateCount: 3,
    evaluationLatencyMs: 132,
    evaluatorRubricVersion: "rewrite-lab-rubric-v1",
    fallbackBehavior: "none",
    generationLatencyMs: 653,
    generatorPromptProfile: "rewrite-lab-candidates-v1",
    model: "playwright-model",
    provider: "Playwright",
    schemaValidation: "passed",
    totalLatencyMs: 785,
    winner: "faithful",
  },
  winnerId: "faithful",
};
