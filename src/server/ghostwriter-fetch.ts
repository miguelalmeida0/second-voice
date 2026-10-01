import { z } from "zod";
import { getSupabasePublic, type Database } from "../integrations/supabase/client.server.ts";
import {
  DEFAULT_OUTCOME_ID,
  normalizeAuthorId,
  type AuthorId,
  type OutcomeId,
  type RewriteMode,
} from "../lib/ghostwriter-shared.ts";
import { logSecurityEvent } from "./security-events.ts";
import { publicSharingEnabled } from "../lib/security-env.ts";

const FetchSchema = z.object({
  id: z.string().regex(/^[abcdefghijkmnopqrstuvwxyz23456789]{8}$/),
});

type PublicRewriteViewRow = Database["public"]["Views"]["ghostwriter_public_rewrites"]["Row"];

export type RewriteGenerationSource = "single_rewrite" | "rewrite_lab";

export type RewriteRow = {
  author: AuthorId;
  created_at: string;
  generation_source: RewriteGenerationSource;
  input_text: string;
  lab_selection_reason: string | null;
  lab_winner_label: string | null;
  lab_winner_score: number | null;
  mood: number;
  outcome: OutcomeId | null;
  output_text: string;
  rewrite_mode: RewriteMode;
  short_id: string;
  source_visible: boolean;
};

function normalizeGenerationSource(value: string): RewriteGenerationSource {
  return value === "rewrite_lab" ? "rewrite_lab" : "single_rewrite";
}

function normalizeRewriteMode(value: string): RewriteMode {
  return value === "outcome" ? "outcome" : "author";
}

function normalizeOutcome(value: string | null): OutcomeId | null {
  switch (value) {
    case "clarity":
    case "reply":
    case "confident":
    case "concise":
    case "persuasive":
      return value;
    default:
      return null;
  }
}

export function sanitizePublicRewriteRow(row: PublicRewriteViewRow): RewriteRow {
  const generationSource = normalizeGenerationSource(row.generation_source);
  const hasLabMetadata = generationSource === "rewrite_lab";
  const rewriteMode = normalizeRewriteMode(row.rewrite_mode);

  return {
    author: normalizeAuthorId(row.author),
    created_at: row.created_at,
    generation_source: generationSource,
    input_text: row.source_visible ? row.input_text : "",
    lab_selection_reason: hasLabMetadata ? row.lab_selection_reason : null,
    lab_winner_label: hasLabMetadata ? row.lab_winner_label : null,
    lab_winner_score: hasLabMetadata ? row.lab_winner_score : null,
    mood: row.mood,
    outcome: rewriteMode === "outcome" ? normalizeOutcome(row.outcome) ?? DEFAULT_OUTCOME_ID : null,
    output_text: row.output_text,
    rewrite_mode: rewriteMode,
    short_id: row.short_id,
    source_visible: row.source_visible,
  };
}

export async function fetchRewriteById(id: string): Promise<RewriteRow | null> {
  // The publication kill switch covers reads, not just creation. Free release
  // does not expose legacy, account-unbound public artifacts.
  if (process.env.GHOSTWRITER_RELEASE_PROFILE === "portfolio-free" ||
      !publicSharingEnabled(process.env.GHOSTWRITER_ALLOW_PUBLIC_SHARING)) return null;
  const parsed = FetchSchema.safeParse({ id });

  if (!parsed.success) {
    return null;
  }

  const supabasePublic = getSupabasePublic();

  if (!supabasePublic) {
    return null;
  }

  const { data, error } = await ((supabasePublic.rpc as unknown) as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: PublicRewriteViewRow[] | null;
    error: { code?: string; message: string } | null;
  }>)("ghostwriter_public_rewrite_lookup", { p_short_id: parsed.data.id });
  const row = data?.[0] ?? null;

  if (error || !row) {
    if (error) {
      logSecurityEvent("public_share_read_failed", {
        code: error.code,
        message: error.message,
      });
    }
    return null;
  }

  return sanitizePublicRewriteRow(row);
}
