import "../lib/server-only.ts";

import { createHash } from "node:crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "@/integrations/supabase/client.server";
import {
  NEGATIVE_REWRITE_FEEDBACK_REASONS,
  POSITIVE_REWRITE_FEEDBACK_REASONS,
  REWRITE_FEEDBACK_RATINGS,
  REWRITE_FEEDBACK_REASONS,
} from "@/lib/ghostwriter-feedback";
import { InputSchema, REWRITE_OUTPUT_MAX_CHARS, RewriteArtifactProvenanceSchema } from "@/server/ghostwriter";
import { cleanupRewriteOutput } from "@/server/ghostwriter-quality";
import { logSecurityEvent } from "@/server/security-events";

type FeedbackRequestContext = {
  requestId?: string;
};

const RewriteFeedbackSubjectSchema = InputSchema.pick({
  author: true,
  mood: true,
});
const POSITIVE_REASON_SET = new Set<string>(POSITIVE_REWRITE_FEEDBACK_REASONS);
const NEGATIVE_REASON_SET = new Set<string>(NEGATIVE_REWRITE_FEEDBACK_REASONS);

export const RewriteFeedbackSchema = RewriteFeedbackSubjectSchema.extend({
  artifactProvenance: RewriteArtifactProvenanceSchema.optional(),
  rating: z.enum(REWRITE_FEEDBACK_RATINGS),
  reason: z.enum(REWRITE_FEEDBACK_REASONS).optional(),
  rewrite: z.string().trim().min(1).max(REWRITE_OUTPUT_MAX_CHARS),
  shortId: z.string().regex(/^[abcdefghijkmnopqrstuvwxyz23456789]{8}$/).optional(),
}).superRefine((feedback, context) => {
  if (!feedback.reason) {
    return;
  }

  const reasonMatchesRating =
    feedback.rating === "positive"
      ? POSITIVE_REASON_SET.has(feedback.reason)
      : NEGATIVE_REASON_SET.has(feedback.reason);

  if (!reasonMatchesRating) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Feedback reason does not match rating.",
      path: ["reason"],
    });
  }
});

export type RewriteFeedbackInput = z.infer<typeof RewriteFeedbackSchema>;

function rewriteHash(rewrite: string): string {
  return createHash("sha256").update(rewrite).digest("hex");
}

function provenanceFields(provenance: RewriteFeedbackInput["artifactProvenance"]) {
  const parsed = provenance ? RewriteArtifactProvenanceSchema.safeParse(provenance) : null;

  if (!parsed || !parsed.success || parsed.data.source === "single_rewrite") {
    return {
      generation_source: "single_rewrite" as const,
      lab_selection_reason: null,
      lab_winner_label: null,
      lab_winner_score: null,
    };
  }

  return {
    generation_source: "rewrite_lab" as const,
    lab_selection_reason: parsed.data.reason,
    lab_winner_label: parsed.data.label,
    lab_winner_score: parsed.data.overall,
  };
}

export async function recordRewriteFeedback(
  input: RewriteFeedbackInput,
  context: FeedbackRequestContext = {},
): Promise<{ error: string | null; status: number }> {
  const rewrite = cleanupRewriteOutput(input.rewrite);

  if (!rewrite || rewrite.length > REWRITE_OUTPUT_MAX_CHARS) {
    return {
      error: "Invalid feedback.",
      status: 400,
    };
  }

  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    logSecurityEvent("feedback_storage_unavailable", {
      requestId: context.requestId,
    });
    return {
      error: "Feedback is temporarily unavailable.",
      status: 503,
    };
  }

  const provenance = provenanceFields(input.artifactProvenance);
  const { error } = await ((supabaseAdmin.from("ghostwriter_feedback") as unknown) as {
    insert: (value: Record<string, unknown>) => Promise<{ error: { code?: string; message: string } | null }>;
  }).insert({
    author: input.author,
    generation_source: provenance.generation_source,
    lab_selection_reason: provenance.lab_selection_reason,
    lab_winner_label: provenance.lab_winner_label,
    lab_winner_score: provenance.lab_winner_score,
    mood: input.mood,
    rating: input.rating,
    reason: input.reason ?? null,
    request_id: context.requestId ?? null,
    rewrite_hash: rewriteHash(rewrite),
    rewrite_short_id: input.shortId ?? null,
  });

  if (error) {
    logSecurityEvent("rewrite_feedback_failed", {
      code: error.code,
      message: error.message,
      requestId: context.requestId,
    });

    return {
      error: "Feedback is temporarily unavailable.",
      status: 503,
    };
  }

  logSecurityEvent("rewrite_feedback_recorded", {
    author: input.author,
    generationSource: provenance.generation_source,
    hasPublicArtifact: Boolean(input.shortId),
    rating: input.rating,
    reason: input.reason ?? "none",
    requestId: context.requestId,
  });

  return {
    error: null,
    status: 200,
  };
}
