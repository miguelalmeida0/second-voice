import "../lib/server-only.ts";

import { z } from "zod";
import { getSupabaseAdmin } from "../integrations/supabase/client.server.ts";
import {
  DEFAULT_OUTCOME_ID,
  DEFAULT_REWRITE_MODE,
  OUTCOMES,
  moodBandIndex,
  moodLabelFor,
  outcomeLabelFor,
  type AuthorId,
  type OutcomeId,
  type RewriteMode,
} from "../lib/ghostwriter-shared.ts";
import { publicSharingEnabled } from "../lib/security-env.ts";
import {
  issueRewriteArtifactToken,
  verifyRewriteArtifactToken,
  type VerifiedRewriteArtifact,
} from "./ghostwriter-artifact-token.ts";
import {
  cleanupRewriteOutput,
  REWRITE_OUTPUT_MAX_CHARS,
  REWRITE_PROMPT_VERSION,
} from "./ghostwriter-quality.ts";
import { logSecurityEvent } from "./security-events.ts";

export {
  cleanupRewriteOutput,
  REWRITE_OUTPUT_MAX_CHARS,
  REWRITE_PROMPT_VERSION,
} from "./ghostwriter-quality.ts";

export const InputSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  mode: z.enum(["author", "outcome"]).default(DEFAULT_REWRITE_MODE),
  author: z.enum(["hemingway", "tolkien", "tolstoy", "stephenking"]).default("tolkien"),
  outcome: z.enum(["clarity", "reply", "confident", "concise", "persuasive"]).default(DEFAULT_OUTCOME_ID),
  mood: z.number().int().min(0).max(100).default(50),
});

export const RewriteArtifactProvenanceSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("single_rewrite"),
  }).strict(),
  z.object({
    source: z.literal("rewrite_lab"),
    label: z.string().trim().min(1).max(80),
    overall: z.number().int().min(0).max(100),
    reason: z.string().trim().min(1).max(280),
  }).strict(),
]);

export type RewriteArtifactProvenance = z.infer<typeof RewriteArtifactProvenanceSchema>;
export type RewriteGenerationSource = "single_rewrite" | "rewrite_lab";

export type GhostwriterInput = z.infer<typeof InputSchema> & {
  artifactProvenance?: RewriteArtifactProvenance;
  sharePublicly?: boolean;
};
type MoodBand = {
  label: string;
  instruction: string;
};

type AuthorProfile = {
  base: string;
  moodName: string;
  bands: [MoodBand, MoodBand, MoodBand, MoodBand, MoodBand];
};

export type GhostwriterResult = {
  artifactToken: string | null;
  rewrite: string;
  shortId: string | null;
  moodLabel: string;
  error: string | null;
  status: number;
};
export type PublicRewriteArtifactInput = z.infer<typeof InputSchema> & {
  artifactToken: string;
  rewrite: string;
};
export type PublicRewriteArtifactResult = {
  error: string | null;
  shortId: string | null;
  status: number;
};
export type RewriteRequestContext = {
  requestId?: string;
};
type RewriteArtifactInsertOptions = {
  shareSourceText?: boolean;
};
type RewriteArtifactProvenanceFields = {
  generation_source: RewriteGenerationSource;
  lab_selection_reason: string | null;
  lab_winner_label: string | null;
  lab_winner_score: number | null;
};
type RewriteModeFields = {
  outcome: OutcomeId | null;
  rewrite_mode: RewriteMode;
};

const AUTHOR_PROFILES: Record<AuthorId, AuthorProfile> = {
  hemingway: {
    base:
      "Write with short declarative sentences, concrete nouns, emotional restraint, and clean rhythm. Cut softness, hedging, and unnecessary flourish. Suggest more than you explain.",
    moodName: "drunk",
    bands: [
      {
        label: "stone sober",
        instruction: "Stay disciplined. Tight, clipped sentences. Almost no adjectives.",
      },
      {
        label: "one whisky in",
        instruction: "Loosen slightly. Allow one image of weather, water, or light.",
      },
      {
        label: "warmly buzzed",
        instruction: "Let one sentence breathe. A flash of feeling, then back to the bone.",
      },
      {
        label: "two thirds drunk",
        instruction: "Romantic undertow. A line about a place, a body, or a war. Still no adverbs.",
      },
      {
        label: "fully sloshed",
        instruction: "Wistful, slightly bruised. Sentences run together. One unguarded confession allowed.",
      },
    ],
  },
  tolkien: {
    base:
      "Write with luminous, old-world cadence, tactile setting detail, moral gravity, and controlled lyricism. Keep it storied but never bloated.",
    moodName: "mythic",
    bands: [
      {
        label: "fireside",
        instruction: "Warm, intimate, and plain. A little hearth-light, no grandiosity.",
      },
      {
        label: "road-worn",
        instruction: "Add the sense of distance traveled. One image of weather, stone, or earth.",
      },
      {
        label: "starlit",
        instruction: "More lyrical. Let wonder enter, but keep the sentence clear and grounded.",
      },
      {
        label: "battle-song",
        instruction: "Give it heroic lift. Strong rhythm, grave stakes, a hint of legend.",
      },
      {
        label: "full legendarium",
        instruction: "Make it feel ancient, fated, and sung forward from memory. Still avoid purple excess.",
      },
    ],
  },
  tolstoy: {
    base:
      "Write with emotional honesty, concrete human detail, moral seriousness, and visible inner conflict. Make the feeling legible without becoming melodramatic.",
    moodName: "philosophical",
    bands: [
      {
        label: "domestic",
        instruction: "Simple, clear, and close to everyday life. Focus on what people feel and do.",
      },
      {
        label: "observant",
        instruction: "Add one precise social or emotional observation. Stay steady and humane.",
      },
      {
        label: "searching",
        instruction: "Turn slightly inward. Let conscience or contradiction surface in the prose.",
      },
      {
        label: "conscience-struck",
        instruction: "Raise the moral stakes. Make the inner struggle impossible to ignore.",
      },
      {
        label: "full Russian soul",
        instruction: "Expansive, intense, and spiritually restless. Let feeling and judgment travel together.",
      },
    ],
  },
  stephenking: {
    base:
      "Write with plainspoken immediacy, vivid sensory detail, and the sense that ordinary life could tilt strange at any second. Stay lucid and human, not campy.",
    moodName: "dread",
    bands: [
      {
        label: "clear daylight",
        instruction: "Stay clean and readable. No horror yet, just sharp human observation.",
      },
      {
        label: "something off",
        instruction: "Let one small detail feel wrong. Keep the prose casual and believable.",
      },
      {
        label: "bad feeling",
        instruction: "Add unease under the surface. Use sensory detail and short jolts of rhythm.",
      },
      {
        label: "lights out",
        instruction: "The scene should feel one step from panic. Ordinary detail, then menace.",
      },
      {
        label: "full nightmare",
        instruction: "Turn the dread all the way up. Keep it lucid, physical, and human, not campy.",
      },
    ],
  },
};

function shortId(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let value = "";

  for (let index = 0; index < 8; index += 1) {
    value += alphabet[bytes[index] % alphabet.length];
  }

  return value;
}

function artifactProvenanceFields(
  provenance: GhostwriterInput["artifactProvenance"],
): RewriteArtifactProvenanceFields {
  const parsed = provenance ? RewriteArtifactProvenanceSchema.safeParse(provenance) : null;

  if (!parsed || !parsed.success || parsed.data.source === "single_rewrite") {
    return {
      generation_source: "single_rewrite",
      lab_selection_reason: null,
      lab_winner_label: null,
      lab_winner_score: null,
    };
  }

  return {
    generation_source: "rewrite_lab",
    lab_selection_reason: parsed.data.reason,
    lab_winner_label: parsed.data.label,
    lab_winner_score: parsed.data.overall,
  };
}

function artifactProvenanceFromVerifiedArtifact(
  artifact: VerifiedRewriteArtifact,
): RewriteArtifactProvenance {
  if (artifact.generationSource !== "rewrite_lab") {
    return {
      source: "single_rewrite",
    };
  }

  if (
    !artifact.labWinnerLabel ||
    artifact.labWinnerScore === null ||
    !artifact.labSelectionReason
  ) {
    return {
      source: "single_rewrite",
    };
  }

  return {
    label: artifact.labWinnerLabel,
    overall: artifact.labWinnerScore,
    reason: artifact.labSelectionReason,
    source: "rewrite_lab",
  };
}

function rewriteModeFields(input: Pick<GhostwriterInput, "mode" | "outcome">): RewriteModeFields {
  if (input.mode === "outcome") {
    return {
      outcome: input.outcome,
      rewrite_mode: "outcome",
    };
  }

  return {
    outcome: null,
    rewrite_mode: "author",
  };
}

export function buildPrompt(author: AuthorId, mood: number): { system: string; moodLabel: string } {
  const profile = AUTHOR_PROFILES[author];
  const band = profile.bands[moodBandIndex(mood)];

  return {
    system: `You are a literary rewrite engine.

Your task is to rewrite the user's passage in the selected voice while preserving the original meaning and intent.

Contract version:
${REWRITE_PROMPT_VERSION}

Hard rules:
- Return only the rewritten passage.
- Do not explain your choices.
- Do not add quotation marks around the answer.
- Do not mention the author or the mood.
- Keep the rewrite similar in length unless the voice strongly benefits from compression.
- Preserve the core message, facts, and point of view.
- Make the passage feel authored, not parody-level caricature.

Selected voice:
${profile.base}

Mood dial:
${mood}% ${profile.moodName}.
Band: ${band.label}.
Instruction: ${band.instruction}

Quality bar:
- The result should be vivid on first read.
- The result should sound confident and intentional.
- Avoid obvious AI filler or generic phrasing.`,
    moodLabel: band.label,
  };
}

export function buildOutcomePrompt(outcome: OutcomeId): { outcomeLabel: string; system: string } {
  const selectedOutcome = OUTCOMES.find((entry) => entry.id === outcome) ?? OUTCOMES[0];

  return {
    outcomeLabel: selectedOutcome.label,
    system: `You are an outcome-driven rewrite engine.

Your task is to rewrite the user's passage to achieve a specific real-world outcome while preserving the original meaning, facts, intent, and point of view.

Contract version:
${REWRITE_PROMPT_VERSION}

Hard rules:
- Return only the rewritten passage.
- Do not explain your choices.
- Do not add quotation marks around the answer.
- Do not mention the outcome label.
- Do not imitate a famous author or literary style.
- Preserve formatting where possible.
- Keep the rewrite natural, human, and close to the user's voice.
- Keep the rewrite similar in length unless the selected outcome benefits from compression.
- Never invent details, claims, promises, or emotional stakes that were not present.

Selected outcome:
${selectedOutcome.instruction}.

Outcome quality bar:
- Improve clarity, structure, and flow.
- Remove unnecessary filler.
- Bring the main point earlier when that improves the outcome.
- Avoid robotic phrasing, buzzwords, and generic AI-sounding language.`,
  };
}

async function insertRewriteArtifact(
  input: z.infer<typeof InputSchema> & {
    artifactProvenance?: RewriteArtifactProvenance;
  },
  rewrite: string,
  context: RewriteRequestContext,
  options: RewriteArtifactInsertOptions = {},
): Promise<string | null> {
  const supabaseAdmin = getSupabaseAdmin();
  const shareSourceText =
    options.shareSourceText ??
    process.env.GHOSTWRITER_SHARE_SOURCE_TEXT?.trim().toLowerCase() === "true";
  const provenanceFields = artifactProvenanceFields(input.artifactProvenance);
  const modeFields = rewriteModeFields(input);

  if (!supabaseAdmin) {
    logSecurityEvent("share_storage_unavailable", {
      provider: "supabase",
      requestId: context.requestId,
    });
    return null;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = shortId();
    const { error } = await ((supabaseAdmin.from("ghostwriter_rewrites") as unknown) as {
      insert: (value: Record<string, unknown>) => Promise<{ error: { code?: string; message: string } | null }>;
    }).insert({
      short_id: candidate,
      author: input.author,
      generation_source: provenanceFields.generation_source,
      is_public: true,
      lab_selection_reason: provenanceFields.lab_selection_reason,
      lab_winner_label: provenanceFields.lab_winner_label,
      lab_winner_score: provenanceFields.lab_winner_score,
      mood: input.mood,
      input_text: shareSourceText ? input.text : "",
      outcome: modeFields.outcome,
      output_text: rewrite,
      rewrite_mode: modeFields.rewrite_mode,
      source_visible: shareSourceText,
    });

    if (!error) {
      logSecurityEvent("public_share_created", {
        author: input.author,
        requestId: context.requestId,
        shareSourceText,
        shortId: candidate,
      });
      return candidate;
    }

    if (error.code !== "23505") {
      logSecurityEvent("public_share_failed", {
        code: error.code,
        message: error.message,
        requestId: context.requestId,
      });
      return null;
    }
  }

  return null;
}

async function persistRewrite(
  input: GhostwriterInput,
  rewrite: string,
  context: RewriteRequestContext,
): Promise<string | null> {
  if (process.env.GHOSTWRITER_RELEASE_PROFILE === "portfolio-free" || !input.sharePublicly || !publicSharingEnabled(process.env.GHOSTWRITER_ALLOW_PUBLIC_SHARING)) {
    return null;
  }

  return insertRewriteArtifact(input, rewrite, context);
}

export async function createPublicRewriteArtifact(
  input: PublicRewriteArtifactInput,
  context: RewriteRequestContext = {},
): Promise<PublicRewriteArtifactResult> {
  if (process.env.GHOSTWRITER_RELEASE_PROFILE === "portfolio-free" || !publicSharingEnabled(process.env.GHOSTWRITER_ALLOW_PUBLIC_SHARING)) {
    return {
      error: "Public sharing is not available.",
      shortId: null,
      status: 503,
    };
  }

  const rewrite = cleanupRewriteOutput(input.rewrite);

  if (!rewrite || rewrite.length > REWRITE_OUTPUT_MAX_CHARS) {
    return {
      error: "Invalid rewrite.",
      shortId: null,
      status: 400,
    };
  }

  const verifiedArtifact = verifyRewriteArtifactToken({
    artifactToken: input.artifactToken,
    author: input.author,
    mode: input.mode,
    mood: input.mood,
    outcome: input.outcome,
    rewrite,
    source: input.text,
  });

  if (!verifiedArtifact) {
    return {
      error: "Invalid rewrite artifact.",
      shortId: null,
      status: 400,
    };
  }

  const shortId = await insertRewriteArtifact(
    {
      author: verifiedArtifact.author,
      mode: verifiedArtifact.mode,
      outcome: verifiedArtifact.outcome ?? DEFAULT_OUTCOME_ID,
      artifactProvenance: artifactProvenanceFromVerifiedArtifact(verifiedArtifact),
      mood: verifiedArtifact.mood,
      text: input.text,
    },
    rewrite,
    context,
    { shareSourceText: false },
  );

  if (!shortId) {
    return {
      error: "Public sharing is not available.",
      shortId: null,
      status: 503,
    };
  }

  return {
    error: null,
    shortId,
    status: 200,
  };
}

export async function finalizeRewrite(
  data: GhostwriterInput,
  rewrite: string,
  context: RewriteRequestContext = {},
): Promise<GhostwriterResult> {
  const startedAt = Date.now();
  const permalinkId = await persistRewrite(data, rewrite, context);
  const provenanceFields = artifactProvenanceFields(data.artifactProvenance);
  const modeFields = rewriteModeFields(data);
  const artifactToken = issueRewriteArtifactToken({
    author: data.author,
    generationSource: provenanceFields.generation_source,
    labSelectionReason: provenanceFields.lab_selection_reason,
    labWinnerLabel: provenanceFields.lab_winner_label,
    labWinnerScore: provenanceFields.lab_winner_score,
    mode: data.mode,
    mood: data.mood,
    outcome: modeFields.outcome,
    rewrite,
    source: data.text,
  });

  logSecurityEvent("rewrite_completed", {
    author: data.author,
    generationSource: data.artifactProvenance?.source ?? "single_rewrite",
    latencyMs: Date.now() - startedAt,
    model: "openai/gpt-oss-20b",
    mood: data.mood,
    outcome: data.mode === "outcome" ? data.outcome : "none",
    outputChars: rewrite.length,
    promptVersion: REWRITE_PROMPT_VERSION,
    provider: "Groq",
    requestId: context.requestId,
    rewriteMode: data.mode,
    shared: Boolean(permalinkId),
  });

  return {
    artifactToken,
    rewrite,
    shortId: permalinkId,
    moodLabel:
      data.mode === "outcome"
        ? outcomeLabelFor(data.outcome)
        : moodLabelFor(data.author, data.mood),
    error: null,
    status: 200,
  };
}
