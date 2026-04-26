import "../lib/server-only.ts";

import { z } from "zod";
import { getSupabaseAdmin } from "@/integrations/supabase/client.server";
import { moodBandIndex, moodLabelFor, type AuthorId } from "@/lib/ghostwriter-shared";
import { publicSharingEnabled, selectAiProvider } from "@/lib/security-env";
import { readLimitedJsonResponse } from "@/server/ai-provider-http";
import {
  cleanupRewriteOutput,
  REWRITE_OUTPUT_MAX_CHARS,
  REWRITE_PROMPT_VERSION,
  validateRewriteProviderPayload,
} from "@/server/ghostwriter-quality";
import { logSecurityEvent } from "@/server/security-events";

export {
  cleanupRewriteOutput,
  REWRITE_OUTPUT_MAX_CHARS,
  REWRITE_PROMPT_VERSION,
} from "@/server/ghostwriter-quality";

export const InputSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  author: z.enum(["hemingway", "tolkien", "tolstoy", "stephenking"]),
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

type GhostwriterInput = z.infer<typeof InputSchema> & {
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

type GhostwriterResult = {
  rewrite: string;
  shortId: string | null;
  moodLabel: string;
  error: string | null;
  status: number;
};
export type PublicRewriteArtifactInput = z.infer<typeof InputSchema> & {
  artifactProvenance?: RewriteArtifactProvenance;
  rewrite: string;
};
export type PublicRewriteArtifactResult = {
  error: string | null;
  shortId: string | null;
  status: number;
};
type RewriteRequestContext = {
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

const GROQ_OPENAI_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_OPENAI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const MAX_REQUEST_TIMEOUT_MS = 30_000;
const PROVIDER_RESPONSE_MAX_BYTES = 64 * 1024;
const REWRITE_MAX_TOKENS = 800;

export type ProviderConfig = {
  apiKey: string;
  label: "Groq" | "Gemini";
  model: string;
  url: string;
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

export function getProviderConfig(): ProviderConfig | null {
  const provider = selectAiProvider({
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    geminiUrl: GEMINI_OPENAI_URL,
    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
    groqUrl: GROQ_OPENAI_URL,
    preferredProvider: process.env.GHOSTWRITER_PROVIDER,
  });

  if (!provider) {
    return null;
  }

  return {
    apiKey: provider.apiKey,
    label: provider.name === "groq" ? "Groq" : "Gemini",
    model: provider.model,
    url: provider.url,
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
      output_text: rewrite,
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
  if (!input.sharePublicly || !publicSharingEnabled(process.env.GHOSTWRITER_ALLOW_PUBLIC_SHARING)) {
    return null;
  }

  return insertRewriteArtifact(input, rewrite, context);
}

export async function createPublicRewriteArtifact(
  input: PublicRewriteArtifactInput,
  context: RewriteRequestContext = {},
): Promise<PublicRewriteArtifactResult> {
  if (!publicSharingEnabled(process.env.GHOSTWRITER_ALLOW_PUBLIC_SHARING)) {
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

  const shortId = await insertRewriteArtifact(
    {
      author: input.author,
      artifactProvenance: input.artifactProvenance,
      mood: input.mood,
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

export async function rewriteText(
  data: GhostwriterInput,
  context: RewriteRequestContext = {},
): Promise<GhostwriterResult> {
  const provider = getProviderConfig();
  const { system, moodLabel } = buildPrompt(data.author, data.mood);
  const startedAt = Date.now();

  if (!provider) {
    return {
      rewrite: "",
      shortId: null,
      moodLabel,
      error: "Rewrite service unavailable.",
      status: 503,
    };
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(
    5_000,
    Math.min(
      MAX_REQUEST_TIMEOUT_MS,
      Number.parseInt(process.env.GHOSTWRITER_REQUEST_TIMEOUT_MS ?? "", 10) ||
        DEFAULT_REQUEST_TIMEOUT_MS,
    ),
  );
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(provider.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        max_tokens: REWRITE_MAX_TOKENS,
        model: provider.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.text },
        ],
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return {
          rewrite: "",
          shortId: null,
          moodLabel,
          error: "Too many requests. Wait a moment.",
          status: 429,
        };
      }

      logSecurityEvent("ai_provider_error", {
        providerRequestId:
          response.headers.get("x-request-id") ||
          response.headers.get("x-groq-id") ||
          response.headers.get("x-cloud-trace-context") ||
          response.headers.get("cf-ray") ||
          "unavailable",
        provider: provider.label,
        requestId: context.requestId,
        status: response.status,
      });

      return {
        rewrite: "",
        shortId: null,
        moodLabel,
        error: "Rewrite service unavailable.",
        status: 503,
      };
    }

    const json = await readLimitedJsonResponse(response, PROVIDER_RESPONSE_MAX_BYTES, {
      signal: controller.signal,
    });
    const validatedRewrite = validateRewriteProviderPayload(json);

    if (!validatedRewrite.ok) {
      logSecurityEvent("ai_provider_output_rejected", {
        guardVersion: validatedRewrite.guardVersion,
        promptVersion: REWRITE_PROMPT_VERSION,
        provider: provider.label,
        reason: validatedRewrite.reason,
        requestId: context.requestId,
        schemaVersion: validatedRewrite.schemaVersion,
      });

      return {
        rewrite: "",
        shortId: null,
        moodLabel,
        error: "Rewrite service unavailable.",
        status: 502,
      };
    }

    const rewrite = validatedRewrite.rewrite;
    const permalinkId = await persistRewrite(data, rewrite, context);

    logSecurityEvent("rewrite_completed", {
      author: data.author,
      generationSource: data.artifactProvenance?.source ?? "single_rewrite",
      latencyMs: Date.now() - startedAt,
      model: provider.model,
      mood: data.mood,
      outputChars: rewrite.length,
      promptVersion: REWRITE_PROMPT_VERSION,
      provider: provider.label,
      requestId: context.requestId,
      shared: Boolean(permalinkId),
    });

    return {
      rewrite,
      shortId: permalinkId,
      moodLabel: moodLabelFor(data.author, data.mood),
      error: null,
      status: 200,
    };
  } catch (error) {
    logSecurityEvent("rewrite_failed", {
      error: error instanceof Error ? error.message : "unknown",
      provider: provider.label,
      requestId: context.requestId,
    });

    return {
      rewrite: "",
      shortId: null,
      moodLabel,
      error: "Rewrite service unavailable.",
      status: 502,
    };
  } finally {
    clearTimeout(timeout);
  }
}
