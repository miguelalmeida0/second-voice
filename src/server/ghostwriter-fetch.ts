import { z } from "zod";
import { getSupabasePublic, type Database } from "../integrations/supabase/client.server.ts";
import { normalizeAuthorId, type AuthorId } from "../lib/ghostwriter-shared.ts";
import { logSecurityEvent } from "./security-events.ts";

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
  output_text: string;
  short_id: string;
  source_visible: boolean;
};

function normalizeGenerationSource(value: string): RewriteGenerationSource {
  return value === "rewrite_lab" ? "rewrite_lab" : "single_rewrite";
}

export function sanitizePublicRewriteRow(row: PublicRewriteViewRow): RewriteRow {
  const generationSource = normalizeGenerationSource(row.generation_source);
  const hasLabMetadata = generationSource === "rewrite_lab";

  return {
    author: normalizeAuthorId(row.author),
    created_at: row.created_at,
    generation_source: generationSource,
    input_text: row.source_visible ? row.input_text : "",
    lab_selection_reason: hasLabMetadata ? row.lab_selection_reason : null,
    lab_winner_label: hasLabMetadata ? row.lab_winner_label : null,
    lab_winner_score: hasLabMetadata ? row.lab_winner_score : null,
    mood: row.mood,
    output_text: row.output_text,
    short_id: row.short_id,
    source_visible: row.source_visible,
  };
}

export async function fetchRewriteById(id: string): Promise<RewriteRow | null> {
  const parsed = FetchSchema.safeParse({ id });

  if (!parsed.success) {
    return null;
  }

  const supabasePublic = getSupabasePublic();

  if (!supabasePublic) {
    return null;
  }

  const { data: row, error } = await supabasePublic
    .from("ghostwriter_public_rewrites")
    .select(
      "short_id,author,mood,input_text,output_text,created_at,source_visible,generation_source,lab_winner_label,lab_winner_score,lab_selection_reason",
    )
    .eq("short_id", parsed.data.id)
    .maybeSingle();

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
